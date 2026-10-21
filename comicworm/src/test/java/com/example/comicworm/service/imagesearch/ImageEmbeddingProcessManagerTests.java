package com.example.comicworm.service.imagesearch;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ImageEmbeddingProcessManagerTests {
    @TempDir Path temporary;
    private Path root;
    private Path python;
    private ImageSearchProperties properties;
    private ImageEmbeddingProcessManager manager;

    @BeforeEach void setup() throws Exception {
        root = temporary.resolve("backend with spaces");
        Files.createDirectories(root.resolve("services/image-embedding"));
        Files.writeString(root.resolve("services/image-embedding/app.py"), "# test fixture");
        String executable = System.getProperty("os.name").toLowerCase(java.util.Locale.ROOT).contains("win")
                ? "Scripts/python.exe" : "bin/python";
        python = root.resolve("services/image-embedding/.venv").resolve(executable);
        Files.createDirectories(python.getParent());
        Files.createFile(python);
        properties = new ImageSearchProperties();
        properties.setEnabled(true);
        properties.setWorkingDirectory(root.toString());
        properties.setServiceUrl("http://127.0.0.1:18091");
        manager = spy(new ImageEmbeddingProcessManager(properties, new ObjectMapper()));
        doReturn(false).when(manager).isHealthy();
        doReturn(false).when(manager).isPortOccupied(any(URI.class));
    }

    @AfterEach void cleanup() { manager.close(); }

    @Test void disabledFeatureAndManualModeNeverLaunchPython() throws Exception {
        properties.setEnabled(false);
        manager.ensureStarted();
        properties.setEnabled(true);
        properties.setAutoStart(false);
        manager.ensureStarted();
        verify(manager, never()).launch(anyList(), any(), any());
        verify(manager, never()).isHealthy();
    }

    @Test void reusesAnExistingHealthyModelWithoutTakingOwnership() throws Exception {
        doReturn(true).when(manager).isHealthy();
        manager.ensureStarted();
        manager.close();
        verify(manager, never()).launch(anyList(), any(), any());
        verify(manager, never()).isPortOccupied(any());
    }

    @Test void doesNotReplaceAnotherApplicationOnThePort() throws Exception {
        doReturn(true).when(manager).isPortOccupied(any());
        manager.ensureStarted();
        verify(manager, never()).launch(anyList(), any(), any());
    }

    @Test void missingPythonDoesNotPreventWebStartup() throws Exception {
        Files.delete(python);
        assertDoesNotThrow(manager::ensureStarted);
        verify(manager, never()).launch(anyList(), any(), any());
    }

    @Test void remoteServicesAreNeverStartedAsLocalProcesses() throws Exception {
        properties.setServiceUrl("https://models.example.invalid:8091");
        manager.ensureStarted();
        verify(manager, never()).launch(anyList(), any(), any());
        verify(manager, never()).isHealthy();
    }

    @Test void startsTheProjectRuntimeWithSeparateArgumentsAndStopsOnlyItsOwnProcess() throws Exception {
        Process process = process();
        doReturn(false, true).when(manager).isHealthy();
        doReturn(process).when(manager).launch(anyList(), any(), any());
        manager.ensureStarted();
        verify(manager).launch(eq(List.of(python.toString(), "-m", "uvicorn", "app:app", "--app-dir",
                root.resolve("services/image-embedding").toString(), "--host", "127.0.0.1", "--port", "18091")),
                eq(root), eq(root.resolve("build/logs/image-embedding.log")));
        manager.close();
        manager.close();
        verify(process, times(1)).destroy();
    }

    @Test void aLaunchFailureDoesNotPreventWebStartup() throws Exception {
        doThrow(new IOException("Unavailable runtime")).when(manager).launch(anyList(), any(), any());
        assertDoesNotThrow(manager::ensureStarted);
    }

    @Test void duplicateReadyEventsStartOnlyOneProcess() throws Exception {
        Process process = process();
        CountDownLatch launched = new CountDownLatch(1);
        doReturn(false, true).when(manager).isHealthy();
        doAnswer(invocation -> { launched.countDown(); return process; })
                .when(manager).launch(anyList(), any(), any());
        try (var context = new AnnotationConfigApplicationContext()) {
            context.registerBean("imageModel", ImageEmbeddingProcessManager.class, () -> manager);
            context.refresh();
            var event = new ApplicationReadyEvent(new SpringApplication(), new String[0], context, Duration.ZERO);
            context.publishEvent(event);
            context.publishEvent(event);
            assertTrue(launched.await(5, TimeUnit.SECONDS));
        }
        verify(manager, times(1)).launch(anyList(), any(), any());
        verify(process, times(1)).destroy();
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "IMAGE_SEARCH_AUTOSTART_LIVE_TEST", matches = "true")
    void startsRealClipFromTheProjectAndClosesItsProcessTree() throws Exception {
        manager.close();
        properties.setWorkingDirectory(Path.of("").toAbsolutePath().toString());
        properties.setStartupTimeoutSeconds(120);
        int port;
        try (ServerSocket socket = new ServerSocket(0)) { port = socket.getLocalPort(); }
        properties.setServiceUrl("http://127.0.0.1:" + port);
        manager = new ImageEmbeddingProcessManager(properties, new ObjectMapper());
        manager.ensureStarted();
        assertTrue(manager.isHealthy(), "The project CLIP model should be ready; inspect build/logs/image-embedding.log.");
        manager.close();
        assertFalse(manager.isPortOccupied(URI.create(properties.getServiceUrl())), "The managed Python process tree must stop with the web app.");
    }

    private Process process() throws Exception {
        Process process = mock(Process.class);
        when(process.isAlive()).thenReturn(true);
        when(process.descendants()).thenAnswer(invocation -> Stream.empty());
        when(process.waitFor(anyLong(), any(TimeUnit.class))).thenReturn(true);
        return process;
    }
}
