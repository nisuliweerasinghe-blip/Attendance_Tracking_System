package com.smartattend.network;

public class SessionManager {

    private static volatile String activeSessionCode = null;

    public static synchronized boolean startSession(String code) {
        if (activeSessionCode != null) {
            return false;
        }

        activeSessionCode = code;
        return true;
    }

    public static synchronized boolean endSession() {
        if (activeSessionCode == null) {
            return false;
        }

        activeSessionCode = null;
        return true;
    }

    public static boolean isSessionActive() {
        return activeSessionCode != null;
    }

    public static boolean validateSession(String code) {
        return activeSessionCode != null
                && activeSessionCode.equals(code);
    }

    public static String getActiveSessionCode() {
        return activeSessionCode;
    }
}
