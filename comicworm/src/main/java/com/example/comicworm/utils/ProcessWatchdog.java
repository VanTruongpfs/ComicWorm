package com.example.comicworm.utils;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Kills a child process tree if its parent dies without running shutdown hooks (for example when an IDE or
 * Gradle hard-stops the JVM on Windows). Stop the watchdog before a normal shutdown so it never fires.
 */
public final class ProcessWatchdog {
    private ProcessWatchdog() {}

    static List<String> command(long parentPid, long childPid) {
        if (System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("win")) {
            return List.of("powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command",
                    "Wait-Process -Id " + parentPid + " -ErrorAction SilentlyContinue; taskkill /PID " + childPid
                            + " /T /F | Out-Null");
        }
        return List.of("sh", "-c", "while kill -0 " + parentPid + " 2>/dev/null; do sleep 1; done; kill " + childPid);
    }

    /** Watches the current JVM. */
    public static Process start(Process child) throws IOException {
        return start(ProcessHandle.current().pid(), child);
    }

    public static Process start(long parentPid, Process child) throws IOException {
        return new ProcessBuilder(command(parentPid, child.pid()))
                .redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                .start();
    }

    public static void stop(Process watchdog) {
        if (watchdog == null) return;
        watchdog.destroyForcibly();
        try {
            watchdog.waitFor(3, TimeUnit.SECONDS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        }
    }
}
