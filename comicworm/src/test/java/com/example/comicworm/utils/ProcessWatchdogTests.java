package com.example.comicworm.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;

class ProcessWatchdogTests {

    @Test
    @EnabledOnOs(OS.WINDOWS)
    void windowsCommandWaitsForTheParentThenKillsTheChildTree() {
        assertEquals(List.of("powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command",
                        "Wait-Process -Id 111 -ErrorAction SilentlyContinue; taskkill /PID 222 /T /F | Out-Null"),
                ProcessWatchdog.command(111, 222));
    }

    @Test
    @EnabledOnOs({OS.LINUX, OS.MAC})
    void unixCommandWaitsForTheParentThenKillsTheChild() {
        assertEquals(List.of("sh", "-c", "while kill -0 111 2>/dev/null; do sleep 1; done; kill 222"),
                ProcessWatchdog.command(111, 222));
    }

    /** A parent killed abruptly (like a hard-stopped JVM) must not leave its AI child running. */
    @Test
    @EnabledOnOs(OS.WINDOWS)
    void killsTheChildWhenTheParentDiesAbruptly() throws Exception {
        Process parent = new ProcessBuilder("ping", "-n", "120", "127.0.0.1").start();
        Process child = new ProcessBuilder("ping", "-n", "120", "127.0.0.1").start();
        Process watchdog = ProcessWatchdog.start(parent.pid(), child);
        try {
            Thread.sleep(2000); // let PowerShell reach Wait-Process
            assertTrue(child.isAlive());
            parent.destroyForcibly();
            assertTrue(child.waitFor(20, TimeUnit.SECONDS), "child should be killed after the parent dies");
        } finally {
            parent.destroyForcibly();
            child.destroyForcibly();
            watchdog.destroyForcibly();
        }
    }

    @Test
    @EnabledOnOs(OS.WINDOWS)
    void stoppingTheWatchdogLeavesTheChildAlone() throws Exception {
        Process parent = new ProcessBuilder("ping", "-n", "120", "127.0.0.1").start();
        Process child = new ProcessBuilder("ping", "-n", "120", "127.0.0.1").start();
        Process watchdog = ProcessWatchdog.start(parent.pid(), child);
        try {
            Thread.sleep(2000);
            ProcessWatchdog.stop(watchdog);
            assertFalse(watchdog.isAlive());
            parent.destroyForcibly();
            Thread.sleep(Duration.ofSeconds(3));
            assertTrue(child.isAlive(), "a stopped watchdog must not kill anything");
        } finally {
            parent.destroyForcibly();
            child.destroyForcibly();
        }
    }
}
