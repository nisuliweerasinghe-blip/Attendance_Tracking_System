package com.smartattend.network;

public class AttendanceMessage {

    private String type;
    private String sessionCode;
    private String studentName;

    // Constructor
    public AttendanceMessage(String type, String sessionCode,
            String studentName) {

        this.type = type;
        this.sessionCode = sessionCode;
        this.studentName = studentName;
    }

    // Create a session started message
    public static AttendanceMessage sessionStarted(String sessionCode) {

        return new AttendanceMessage(
                "SESSION_STARTED",
                sessionCode,
                null
        );
    }

    // Create an attendance confirmation message
    public static AttendanceMessage attendanceConfirmed(
            String sessionCode, String studentName) {

        return new AttendanceMessage(
                "ATTENDANCE_CONFIRMED",
                sessionCode,
                studentName
        );
    }

    // Create a session ended message
    public static AttendanceMessage sessionEnded(String sessionCode) {

        return new AttendanceMessage(
                "SESSION_ENDED",
                sessionCode,
                null
        );
    }

    // Convert the message into a format for TCP transmission
    public String toProtocolString() {

        return type + "|" +
                (sessionCode == null ? "" : sessionCode) + "|" +
                (studentName == null ? "" : studentName);
    }
}
