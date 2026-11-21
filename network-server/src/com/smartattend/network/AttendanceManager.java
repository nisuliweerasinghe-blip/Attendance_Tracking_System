package com.smartattend.network;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class AttendanceManager {

    private static final Set<String> attendedStudents =
            ConcurrentHashMap.newKeySet();

    public static boolean markAttendance(
            String sessionCode, String studentName) {

        String attendanceKey =
                sessionCode + "|" + studentName.trim().toLowerCase();

        return attendedStudents.add(attendanceKey);
    }

    public static int getAttendanceCount(String sessionCode) {

        int count = 0;

        String prefix = sessionCode + "|";

        for (String key : attendedStudents) {
            if (key.startsWith(prefix)) {
                count++;
            }
        }

        return count;
    }

    public static void clearSessionAttendance(String sessionCode) {

        String prefix = sessionCode + "|";

        attendedStudents.removeIf(
                key -> key.startsWith(prefix));
    }
}
