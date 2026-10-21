package com.example.comicworm.service.imagesearch;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Owns only the local Python process it launches; an existing service is never stopped. */
@Component
@Profile("!preview")
@Slf4j
public class ImageEmbeddingProcessManager implements AutoCloseable {
    private static final Set<String> LOCAL_HOSTS = Set.of("127.0.0.1", "localhost");
    private final ImageSearchProperties properties;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final ExecutorService worker = Executors.newSingleThreadExecutor(
            Thread.ofPlatform().daemon(true).name("image-model-startup").factory());
    private final AtomicBoolean submitted = new AtomicBoolean();
    private final AtomicBoolean closing = new AtomicBoolean();
    private final Object processLock = new Object();
    private volatile Process ownedProcess;

    public ImageEmbeddingProcessManager(ImageSearchProperties properties, ObjectMapper json) {
        this.properties = properties;
        this.json = json;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        if (properties.isEnabled() && properties.isAutoStart() && !closing.get()
                && submitted.compareAndSet(false, true)) {
            worker.submit(this::ensureStarted);
        }
    }

    void ensureStarted() {
        if (!properties.isEnabled() || !properties.isAutoStart() || closing.get()) return;
        try {
            URI service = URI.create(properties.getServiceUrl());
            if (!"http".equalsIgnoreCase(service.getScheme()) || service.getHost() == null
                    || !LOCAL_HOSTS.contains(service.getHost().toLowerCase(java.util.Locale.ROOT))
                    || service.getUserInfo() != null || service.getPort() < 1
                    || (service.getPath() != null && !Set.of("", "/").contains(service.getPath()))
                    || service.getQuery() != null || service.getFragment() != null) {
                log.info("Image model auto-start requires a local http://127.0.0.1:<port> service URL.");
                return;
            }
            if (isHealthy()) {
                log.info("Using the existing local image model at {}.", properties.getServiceUrl());
                return;
            }
            if (isPortOccupied(service)) {
                log.warn("Image service port {} is already in use but its model health does not match. No process was started.", service.getPort());
                return;
            }
            Path root = findBackendRoot();
            if (root == null) {
                log.warn("Image model auto-start could not find services/image-embedding/app.py. Set app.image-search.working-directory to the backend folder.");
                return;
            }
            Path python = findPython(root);
            if (!Files.isRegularFile(python)) {
                log.warn("Image search needs its Python environment at {}. Install services/image-embedding/requirements.txt once; see docs/new-machine-setup.md. The web app remains available.", python);
                return;
            }
            Path logFile = root.resolve("build/logs/image-embedding.log");
            Files.createDirectories(logFile.getParent());
            List<String> command = List.of(python.toString(), "-m", "uvicorn", "app:app", "--app-dir",
                    root.resolve("services/image-embedding").toString(), "--host", "127.0.0.1", "--port",
                    Integer.toString(service.getPort()));
            synchronized (processLock) {
                if (closing.get()) return;
                ownedProcess = launch(command, root, logFile);
            }
            log.info("Starting local CLIP image model. Startup progress: {}", logFile);
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(
                    Math.clamp(properties.getStartupTimeoutSeconds(), 1, 1800));
            while (!closing.get() && !Thread.currentThread().isInterrupted()) {
                if (isHealthy()) {
                    log.info("Local image model is ready at {}.", properties.getServiceUrl());
                    return;
                }
                if (!ownedProcess.isAlive()) {
                    log.warn("Image model process exited with status {}. Check {}.", ownedProcess.exitValue(), logFile);
                    return;
                }
                if (System.nanoTime() >= deadline) {
                    log.info("Image model is still loading; it will remain running. Check {} for model download progress.", logFile);
                    return;
                }
                Thread.sleep(1000);
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        } catch (IOException | RuntimeException error) {
            log.warn("Could not auto-start the local image model ({}). See docs/new-machine-setup.md.", error.getClass().getSimpleName());
        }
    }

    Path findBackendRoot() {
        Path candidate = Path.of(properties.getWorkingDirectory().isBlank()
                ? System.getProperty("user.dir") : properties.getWorkingDirectory()).toAbsolutePath().normalize();
        for (int level = 0; candidate != null && level < 7; level++, candidate = candidate.getParent()) {
            if (Files.isRegularFile(candidate.resolve("services/image-embedding/app.py"))) return candidate;
            Path nested = candidate.resolve("comicworm");
            if (Files.isRegularFile(nested.resolve("services/image-embedding/app.py"))) return nested;
        }
        return null;
    }

    private Path findPython(Path root) {
        if (!properties.getPythonExecutable().isBlank()) {
            return root.resolve(properties.getPythonExecutable()).toAbsolutePath().normalize();
        }
        String executable = System.getProperty("os.name").toLowerCase(java.util.Locale.ROOT).contains("win")
                ? "Scripts/python.exe" : "bin/python";
        return root.resolve("services/image-embedding/.venv").resolve(executable);
    }

    boolean isHealthy() {
        try {
            String url = properties.getServiceUrl().replaceAll("/+$", "") + "/health";
            var request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(2)).GET().build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return false;
            var body = json.readTree(response.body());
            return "ready".equals(body.path("status").asText())
                    && properties.getModelName().equals(body.path("modelName").asText())
                    && body.path("dimensions").asInt() == properties.getDimensions();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return false;
        } catch (IOException | RuntimeException error) {
            return false;
        }
    }

    boolean isPortOccupied(URI service) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(service.getHost(), service.getPort()), 500);
            return true;
        } catch (IOException error) {
            return false;
        }
    }

    Process launch(List<String> command, Path root, Path logFile) throws IOException {
        ProcessBuilder builder = new ProcessBuilder(command).directory(root.toFile())
                .redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.appendTo(logFile.toFile()));
        builder.environment().put("PYTHONUNBUFFERED", "1");
        return builder.start();
    }

    @Override
    @PreDestroy
    public void close() {
        if (!closing.compareAndSet(false, true)) return;
        worker.shutdownNow();
        synchronized (processLock) {
            Process process = ownedProcess;
            if (process == null) return;
            var children = process.descendants().toList();
            children.forEach(ProcessHandle::destroy);
            process.destroy();
            try {
                if (!process.waitFor(3, TimeUnit.SECONDS)) {
                    process.destroyForcibly();
                    process.waitFor(3, TimeUnit.SECONDS);
                }
                children.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
                // Windows venv launchers can exit before their Python child releases its port.
                CompletableFuture.allOf(children.stream().map(ProcessHandle::onExit)
                        .toArray(CompletableFuture[]::new)).get(3, TimeUnit.SECONDS);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                process.destroyForcibly();
            } catch (ExecutionException | TimeoutException error) {
                log.warn("Some image model processes did not confirm shutdown in time.");
            } finally {
                children.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
            }
        }
    }
}
