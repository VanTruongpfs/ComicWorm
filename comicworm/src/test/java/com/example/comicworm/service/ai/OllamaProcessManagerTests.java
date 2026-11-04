package com.example.comicworm.service.ai;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;

class OllamaProcessManagerTests {
    @TempDir Path temporary;
    private Path root;
    private Path modelDir;
    private Path ollama;
    private ChatbotOllamaProperties properties;
    private OllamaProcessManager manager;

    @BeforeEach void setup() throws Exception {
        root = temporary.resolve("backend with spaces");
        modelDir = root.resolve("chatbot");
        Files.createDirectories(modelDir);
        Files.writeString(modelDir.resolve("Modelfile"), "FROM model.gguf");
        ollama = root.resolve("bin/ollama.exe");
        Files.createDirectories(ollama.getParent());
        Files.createFile(ollama);
        properties = new ChatbotOllamaProperties();
        properties.setAutoStart(true);
        properties.setWorkingDirectory(root.toString());
        properties.setExecutable(ollama.toString());
        manager = spy(new OllamaProcessManager(properties, new ObjectMapper(),
                "http://localhost:11434", "qwen-comicworm"));
        doReturn(false).when(manager).isServerUp();
        doReturn(false).when(manager).isPortOccupied(any(URI.class));
        doReturn(Set.of("qwen-comicworm:latest")).when(manager).installedModels();
        doReturn(true).when(manager).warmUp();
        doReturn(true).when(manager).unloadModel();
        doReturn(null).when(manager).startWatchdog(any());
    }

    @Test void unloadsTheModelFromASharedServerOnShutdown() throws Exception {
        doReturn(true).when(manager).isServerUp();
        manager.ensureStarted();
        manager.close();
        verify(manager, times(1)).unloadModel();
    }

    @Test void manualModeDoesNotUnloadAnythingOnShutdown() throws Exception {
        properties.setAutoStart(false);
        manager.ensureStarted();
        manager.close();
        verify(manager, never()).unloadModel();
    }

    @Test void ownedServerIsGuardedByAWatchdogThatIsStoppedFirst() throws Exception {
        Process serve = process();
        Process watchdog = process();
        doReturn(false, true).when(manager).isServerUp();
        doReturn(serve).when(manager).launch(anyList(), any(), any());
        doReturn(watchdog).when(manager).startWatchdog(serve);
        manager.ensureStarted();
        manager.close();
        var order = inOrder(watchdog, serve);
        order.verify(watchdog).destroyForcibly();
        order.verify(serve).destroy();
        verify(manager, never()).unloadModel();
    }

    @AfterEach void cleanup() { manager.close(); }

    @Test void manualModeNeverTouchesOllama() throws Exception {
        properties.setAutoStart(false);
        manager.ensureStarted();
        verify(manager, never()).isServerUp();
        verify(manager, never()).launch(anyList(), any(), any());
    }

    @Test void remoteServersAreNeverStartedLocally() throws Exception {
        manager = spy(new OllamaProcessManager(properties, new ObjectMapper(),
                "https://api.example.invalid", "qwen-comicworm"));
        manager.ensureStarted();
        verify(manager, never()).isServerUp();
        verify(manager, never()).launch(anyList(), any(), any());
    }

    @Test void reusesARunningServerWithInstalledModelWithoutTakingOwnership() throws Exception {
        doReturn(true).when(manager).isServerUp();
        manager.ensureStarted();
        manager.close();
        verify(manager, never()).launch(anyList(), any(), any());
        verify(manager, never()).isPortOccupied(any());
        verify(manager).warmUp();
    }

    @Test void doesNotReplaceAnotherApplicationOnThePort() throws Exception {
        doReturn(true).when(manager).isPortOccupied(any());
        manager.ensureStarted();
        verify(manager, never()).launch(anyList(), any(), any());
    }

    @Test void missingOllamaDoesNotPreventWebStartup() throws Exception {
        Files.delete(ollama);
        assertDoesNotThrow(manager::ensureStarted);
        verify(manager, never()).launch(anyList(), any(), any());
    }

    @Test void startsServeOnTheConfiguredPortAndStopsOnlyItsOwnProcess() throws Exception {
        Process serve = process();
        doReturn(false, true).when(manager).isServerUp();
        doReturn(serve).when(manager).launch(anyList(), any(), any());
        manager.ensureStarted();
        verify(manager).launch(eq(List.of(ollama.toString(), "serve")), eq(root),
                eq(root.resolve("build/logs/ollama.log")));
        verify(manager).warmUp();
        manager.close();
        manager.close();
        verify(serve, times(1)).destroy();
    }

    @Test void createsTheModelFromModelfileWhenMissing() throws Exception {
        doReturn(true).when(manager).isServerUp();
        doReturn(Set.of(), Set.of("qwen-comicworm:latest")).when(manager).installedModels();
        Process create = process();
        when(create.waitFor(any(Long.class), any(TimeUnit.class))).thenReturn(true);
        when(create.exitValue()).thenReturn(0);
        doReturn(create).when(manager).launch(anyList(), any(), any());
        manager.ensureStarted();
        verify(manager).launch(eq(List.of(ollama.toString(), "create", "qwen-comicworm", "-f", "Modelfile")),
                eq(modelDir), eq(root.resolve("build/logs/ollama.log")));
        verify(manager).warmUp();
        manager.close();
        verify(create, never()).destroy();
    }

    @Test void missingModelfileSkipsCreateWithoutFailing() throws Exception {
        Files.delete(modelDir.resolve("Modelfile"));
        doReturn(true).when(manager).isServerUp();
        doReturn(Set.of()).when(manager).installedModels();
        assertDoesNotThrow(manager::ensureStarted);
        verify(manager, never()).launch(anyList(), any(), any());
        verify(manager, never()).warmUp();
    }

    @Test void aLaunchFailureDoesNotPreventWebStartup() throws Exception {
        doThrow(new IOException("Unavailable runtime")).when(manager).launch(anyList(), any(), any());
        assertDoesNotThrow(manager::ensureStarted);
    }

    /** Runs a real Ollama on a spare port, creates a throwaway model from chatbot/Modelfile, then removes it. */
    @Test
    @EnabledIfEnvironmentVariable(named = "OLLAMA_AUTOSTART_LIVE_TEST", matches = "true")
    void startsRealOllamaCreatesTheModelAndStopsItsServer() throws Exception {
        Path project = Path.of(System.getProperty("user.dir"));
        int port;
        try (ServerSocket socket = new ServerSocket(0)) { port = socket.getLocalPort(); }
        String testModel = "qwen-comicworm-livetest";
        properties.setWorkingDirectory(project.toString());
        properties.setExecutable("");
        properties.setStartupTimeoutSeconds(60);
        manager = new OllamaProcessManager(properties, new ObjectMapper(), "http://127.0.0.1:" + port, testModel);
        Path ollamaExe = manager.findOllama();
        assertNotNull(ollamaExe, "Ollama must be installed");
        try {
            manager.ensureStarted();
            assertTrue(manager.isServerUp(), "server should be up on port " + port);
            assertTrue(manager.installedModels().contains(testModel + ":latest"), "model should be created");
            assertTrue(manager.warmUp(), "model should load");
        } finally {
            var remove = new ProcessBuilder(ollamaExe.toString(), "rm", testModel).inheritIO();
            remove.environment().put("OLLAMA_HOST", "127.0.0.1:" + port);
            remove.start().waitFor(60, TimeUnit.SECONDS);
            manager.close();
        }
        assertFalse(manager.isServerUp(), "owned server should stop on close");
    }

    private static Process process() {
        Process process = mock(Process.class);
        when(process.isAlive()).thenReturn(true);
        when(process.descendants()).thenReturn(Stream.empty());
        return process;
    }
}
