package com.example.comicworm.service.ai;

import com.example.comicworm.utils.ProcessWatchdog;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import java.io.File;
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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Starts the local Ollama server for the chatbot and creates its model from chatbot/Modelfile when missing.
 * Owns only the server process it launches; an Ollama that was already running is never stopped.
 */
@Component
@Slf4j
public class OllamaProcessManager implements AutoCloseable {
    private static final Set<String> LOCAL_HOSTS = Set.of("127.0.0.1", "localhost");
    private static final String SETUP_DOC = "docs/chatbot-ollama-setup.md";
    private final ChatbotOllamaProperties properties;
    private final ObjectMapper json;
    private final String baseUrl;
    private final String model;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final ExecutorService worker = Executors.newSingleThreadExecutor(
            Thread.ofPlatform().daemon(true).name("ollama-startup").factory());
    private final AtomicBoolean submitted = new AtomicBoolean();
    private final AtomicBoolean closing = new AtomicBoolean();
    private final Object processLock = new Object();
    private volatile Process ownedServer;
    private volatile Process watchdog;
    /** Set once auto-start has handled a local server, so shutdown knows it may unload the model. */
    private volatile boolean managed;

    public OllamaProcessManager(ChatbotOllamaProperties properties, ObjectMapper json,
                                @Value("${spring.ai.openai.base-url:http://localhost:11434}") String baseUrl,
                                @Value("${spring.ai.openai.chat.options.model:qwen-comicworm}") String model) {
        this.properties = properties;
        this.json = json;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.model = model;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        if (properties.isAutoStart() && !closing.get() && submitted.compareAndSet(false, true)) {
            worker.submit(this::ensureStarted);
        }
    }

    void ensureStarted() {
        if (!properties.isAutoStart() || closing.get()) return;
        try {
            URI server = URI.create(baseUrl);
            if (!"http".equalsIgnoreCase(server.getScheme()) || server.getHost() == null
                    || !LOCAL_HOSTS.contains(server.getHost().toLowerCase(Locale.ROOT))
                    || server.getUserInfo() != null || server.getPort() < 1
                    || (server.getPath() != null && !Set.of("", "/").contains(server.getPath()))
                    || server.getQuery() != null || server.getFragment() != null) {
                log.info("Chatbot Ollama auto-start requires a local http://localhost:<port> spring.ai.openai.base-url.");
                return;
            }
            Path root = backendRoot();
            Path logFile = root.resolve("build/logs/ollama.log");
            Path ollama = findOllama();
            managed = true;

            if (isServerUp()) {
                log.info("Using the running Ollama server at {}.", baseUrl);
            } else {
                if (isPortOccupied(server)) {
                    log.warn("Ollama port {} is in use by another application. The chatbot will not work until it is freed.", server.getPort());
                    return;
                }
                if (ollama == null) {
                    log.warn("Chatbot needs Ollama, which was not found. Install it (see {}) or set app.chatbot.ollama.executable. The web app remains available.", SETUP_DOC);
                    return;
                }
                Files.createDirectories(logFile.getParent());
                synchronized (processLock) {
                    if (closing.get()) return;
                    ownedServer = launch(List.of(ollama.toString(), "serve"), root, logFile);
                    try {
                        watchdog = startWatchdog(ownedServer);
                    } catch (IOException error) {
                        log.warn("Could not start the Ollama watchdog; if the app is force-stopped, end ollama.exe manually.");
                    }
                }
                log.info("Starting local Ollama server for the chatbot. Log: {}", logFile);
                if (!waitForServer(logFile)) return;
            }

            if (!isModelInstalled()) {
                if (!createModel(ollama, root, logFile)) return;
            }
            if (properties.isWarmUp() && !closing.get()) {
                log.info("Loading chatbot model '{}' into memory...", model);
                if (warmUp()) log.info("Chatbot model '{}' is ready.", model);
                else log.warn("Chatbot model '{}' did not load; the first chat message may be slow or fail. Check {}.", model, logFile);
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        } catch (IOException | RuntimeException error) {
            log.warn("Could not auto-start Ollama for the chatbot ({}). See {}.", error.getClass().getSimpleName(), SETUP_DOC);
        }
    }

    private boolean waitForServer(Path logFile) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(
                Math.clamp(properties.getStartupTimeoutSeconds(), 1, 600));
        while (!closing.get() && !Thread.currentThread().isInterrupted()) {
            if (isServerUp()) {
                log.info("Ollama server is ready at {}.", baseUrl);
                return true;
            }
            if (!ownedServer.isAlive()) {
                log.warn("Ollama server exited with status {}. Check {}.", ownedServer.exitValue(), logFile);
                return false;
            }
            if (System.nanoTime() >= deadline) {
                log.warn("Ollama server did not respond within {}s. Check {}.", properties.getStartupTimeoutSeconds(), logFile);
                return false;
            }
            Thread.sleep(500);
        }
        return false;
    }

    private boolean createModel(Path ollama, Path root, Path logFile) throws IOException, InterruptedException {
        Path modelDir = resolveModelDirectory(root);
        if (!Files.isRegularFile(modelDir.resolve("Modelfile"))) {
            log.warn("Chatbot model '{}' is not installed and {} has no Modelfile. Download Modelfile and the .gguf into that folder (see {}).",
                    model, modelDir, SETUP_DOC);
            return false;
        }
        if (ollama == null) {
            log.warn("Chatbot model '{}' is not installed and the ollama command was not found to create it. Set app.chatbot.ollama.executable.", model);
            return false;
        }
        Files.createDirectories(logFile.getParent());
        log.info("Creating chatbot model '{}' from {} (one time, may take a minute). Log: {}", model, modelDir, logFile);
        Process create = launch(List.of(ollama.toString(), "create", model, "-f", "Modelfile"), modelDir, logFile);
        try {
            boolean finished = create.waitFor(Math.clamp(properties.getCreateTimeoutSeconds(), 1, 3600), TimeUnit.SECONDS);
            if (!finished) {
                create.destroy();
                log.warn("Creating chatbot model '{}' timed out. Check {}.", model, logFile);
                return false;
            }
        } catch (InterruptedException error) {
            create.destroy();
            throw error;
        }
        if (create.exitValue() != 0 || !isModelInstalled()) {
            log.warn("Creating chatbot model '{}' failed (exit {}). Check {}.", model, create.exitValue(), logFile);
            return false;
        }
        log.info("Chatbot model '{}' was created.", model);
        return true;
    }

    private boolean isModelInstalled() {
        Set<String> names = installedModels();
        return names.contains(model) || names.contains(model + ":latest");
    }

    Path backendRoot() {
        return Path.of(properties.getWorkingDirectory().isBlank()
                ? System.getProperty("user.dir") : properties.getWorkingDirectory()).toAbsolutePath().normalize();
    }

    Path resolveModelDirectory(Path root) {
        Path configured = Path.of(properties.getModelDirectory());
        if (configured.isAbsolute()) return configured.normalize();
        Path direct = root.resolve(configured).normalize();
        Path nested = root.resolve("comicworm").resolve(configured).normalize();
        return !Files.isDirectory(direct) && Files.isDirectory(nested) ? nested : direct;
    }

    Path findOllama() {
        if (!properties.getExecutable().isBlank()) {
            Path configured = Path.of(properties.getExecutable()).toAbsolutePath().normalize();
            return Files.isRegularFile(configured) ? configured : null;
        }
        boolean windows = System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("win");
        String name = windows ? "ollama.exe" : "ollama";
        String path = System.getenv("PATH");
        if (path != null) {
            for (String dir : path.split(File.pathSeparator)) {
                if (dir.isBlank()) continue;
                try {
                    Path candidate = Path.of(dir.trim()).resolve(name);
                    if (Files.isRegularFile(candidate)) return candidate;
                } catch (RuntimeException ignored) {
                    // Malformed PATH entry.
                }
            }
        }
        String localAppData = System.getenv("LOCALAPPDATA");
        if (windows && localAppData != null) {
            Path installed = Path.of(localAppData, "Programs", "Ollama", name);
            if (Files.isRegularFile(installed)) return installed;
        }
        return null;
    }

    boolean isServerUp() {
        try {
            return get("/api/tags").statusCode() == 200;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return false;
        } catch (IOException | RuntimeException error) {
            return false;
        }
    }

    Set<String> installedModels() {
        try {
            var response = get("/api/tags");
            if (response.statusCode() != 200) return Set.of();
            Set<String> names = new HashSet<>();
            json.readTree(response.body()).path("models").forEach(m -> names.add(m.path("name").asText()));
            return names;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return Set.of();
        } catch (IOException | RuntimeException error) {
            return Set.of();
        }
    }

    /** Asks Ollama to load the model without generating anything. */
    boolean warmUp() {
        try {
            String body = json.writeValueAsString(java.util.Map.of("model", model));
            var request = HttpRequest.newBuilder(URI.create(baseUrl + "/api/generate"))
                    .timeout(Duration.ofMinutes(3))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() == 200;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return false;
        } catch (IOException | RuntimeException error) {
            return false;
        }
    }

    /** Frees the model's memory on a server this app does not own; the server itself keeps running. */
    boolean unloadModel() {
        try {
            String body = json.writeValueAsString(java.util.Map.of("model", model, "keep_alive", 0));
            var request = HttpRequest.newBuilder(URI.create(baseUrl + "/api/generate"))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() == 200;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return false;
        } catch (IOException | RuntimeException error) {
            return false;
        }
    }

    Process startWatchdog(Process server) throws IOException {
        return ProcessWatchdog.start(server);
    }

    private HttpResponse<String> get(String path) throws IOException, InterruptedException {
        var request = HttpRequest.newBuilder(URI.create(baseUrl + path)).timeout(Duration.ofSeconds(2)).GET().build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    boolean isPortOccupied(URI server) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(server.getHost(), server.getPort()), 500);
            return true;
        } catch (IOException error) {
            return false;
        }
    }

    Process launch(List<String> command, Path directory, Path logFile) throws IOException {
        URI server = URI.create(baseUrl);
        ProcessBuilder builder = new ProcessBuilder(command).directory(directory.toFile())
                .redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.appendTo(logFile.toFile()));
        builder.environment().put("OLLAMA_HOST", server.getHost() + ":" + server.getPort());
        return builder.start();
    }

    @Override
    @PreDestroy
    public void close() {
        if (!closing.compareAndSet(false, true)) return;
        worker.shutdownNow();
        synchronized (processLock) {
            Process process = ownedServer;
            if (process == null) {
                if (managed && unloadModel()) log.info("Unloaded chatbot model '{}' from Ollama.", model);
                return;
            }
            ProcessWatchdog.stop(watchdog);
            var children = process.descendants().toList();
            children.forEach(ProcessHandle::destroy);
            process.destroy();
            try {
                if (!process.waitFor(3, TimeUnit.SECONDS)) {
                    process.destroyForcibly();
                    process.waitFor(3, TimeUnit.SECONDS);
                }
                children.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
                CompletableFuture.allOf(children.stream().map(ProcessHandle::onExit)
                        .toArray(CompletableFuture[]::new)).get(3, TimeUnit.SECONDS);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                process.destroyForcibly();
            } catch (ExecutionException | TimeoutException error) {
                log.warn("Some Ollama processes did not confirm shutdown in time.");
            } finally {
                children.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
            }
        }
    }
}
