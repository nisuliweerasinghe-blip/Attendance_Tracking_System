package com.smartattend.network;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;

public class ClientHandler implements Runnable {

    private final Socket socket;

    public ClientHandler(Socket socket) {
        this.socket = socket;
    }

    @Override
    public void run() {

        try (
            BufferedReader input = new BufferedReader(
                    new InputStreamReader(socket.getInputStream()));

            PrintWriter output = new PrintWriter(
                    socket.getOutputStream(), true)
        ) {

            output.println("Welcome to SmartAttend TCP Server!");

            // First message identifies the client role.
            String roleMessage = input.readLine();

            if (roleMessage == null ||
                    !roleMessage.startsWith("ROLE|")) {

                output.println("INVALID_ROLE");
                return;
            }

            String role = roleMessage.substring(5).trim()
                    .toUpperCase();

            if (!role.equals("STUDENT") &&
                    !role.equals("LECTURER")) {

                output.println("INVALID_ROLE");
                return;
            }

            ClientManager.addClient(socket, output, role);

            HeartbeatManager.registerClient(socket);

            System.out.println(
                    role + " client handler started.");

            String message;

            while ((message = input.readLine()) != null) {

                // Heartbeat request
                if (message.equalsIgnoreCase("PING")) {

                    HeartbeatManager.updateHeartbeat(socket);
                    output.println("PONG");
                    continue;
                }

                // Disconnect request
                if (message.equalsIgnoreCase("EXIT")) {
                    break;
                }

                // Only students can submit attendance.
                if (message.startsWith("ATTENDANCE|")) {

                    if (!role.equals("STUDENT")) {
                        output.println("UNAUTHORIZED");
                        continue;
                    }

                    String[] parts = message.split("\\|", 3);

                    if (parts.length != 3) {
                        output.println("INVALID_REQUEST");
                        continue;
                    }

                    String sessionCode = parts[1].trim();
                    String studentName = parts[2].trim();

                    if (sessionCode.isEmpty() ||
                            studentName.isEmpty()) {

                        output.println("INVALID_REQUEST");
                        continue;
                    }

                    if (!SessionManager.validateSession(
                            sessionCode)) {

                        output.println("INVALID_SESSION");

                        System.out.println(
                                "Invalid session code submitted by: "
                                + studentName);

                        continue;
                    }

                    boolean isNewAttendance =
                            AttendanceManager.markAttendance(
                                    sessionCode, studentName);

                    if (isNewAttendance) {

                        // Private confirmation to the submitting student.
                        ClientManager.sendToClient(
                                socket, "ATTENDANCE_SUCCESS");

                        int count =
                                AttendanceManager.getAttendanceCount(
                                        sessionCode);

                        System.out.println(
                                studentName + " attendance recorded.");

                        System.out.println(
                                "Total attendance: " + count);

                        // Attendance information goes only to lecturers.
                        ClientManager.broadcastToRole(
                                "LECTURER",
                                "ATTENDANCE_UPDATE|"
                                + sessionCode + "|"
                                + studentName + "|"
                                + count);

                    } else {

                        ClientManager.sendToClient(
                                socket, "DUPLICATE_ATTENDANCE");

                        System.out.println(
                                studentName
                                + " attempted duplicate attendance.");
                    }

                    continue;
                }

                output.println("UNKNOWN_COMMAND");
            }

        } catch (IOException e) {

            System.out.println(
                    "Client communication error: "
                    + e.getMessage());

        } finally {

            HeartbeatManager.removeClient(socket);

            ClientManager.removeClient(socket);

            try {
                socket.close();
            } catch (IOException e) {
                System.out.println(
                        "Error closing client connection.");
            }

            System.out.println("Client connection closed.");
        }
    }
}
