package com.smartattend.network;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Scanner;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class TCPServer {

    private static final int PORT = 6000;

    public static void main(String[] args) {

        ScheduledExecutorService scheduler =
                Executors.newSingleThreadScheduledExecutor();

        try (ServerSocket serverSocket =
                     new ServerSocket(PORT)) {

            System.out.println(
                    "SmartAttend TCP Server Started!");

            System.out.println(
                    "Listening on port: " + PORT);

            // Heartbeat monitoring
            scheduler.scheduleAtFixedRate(
                    HeartbeatManager::checkInactiveClients,
                    10,
                    5,
                    TimeUnit.SECONDS);

            // Lecturer console menu
            Thread commandThread = new Thread(
                    TCPServer::lecturerMenu);

            commandThread.setDaemon(true);
            commandThread.start();

            // Accept client connections
            while (true) {

                Socket clientSocket = serverSocket.accept();

                clientSocket.setKeepAlive(true);
                clientSocket.setTcpNoDelay(true);

                System.out.println(
                        "New client connected: "
                        + clientSocket.getInetAddress());

                ClientHandler handler =
                        new ClientHandler(clientSocket);

                Thread clientThread = new Thread(handler);

                clientThread.start();
            }

        } catch (IOException e) {

            System.out.println(
                    "Server Error: " + e.getMessage());

        } finally {

            scheduler.shutdownNow();
        }
    }

    private static void lecturerMenu() {

        Scanner scanner = new Scanner(System.in);

        while (true) {

            System.out.println(
                    "\n--- SmartAttend Lecturer Menu ---");

            System.out.println("1. Start Attendance Session");
            System.out.println("2. End Attendance Session");
            System.out.println("3. View Attendance Count");
            System.out.println("4. View Connected Clients");

            System.out.print("Select option: ");

            String choice;

            try {
                choice = scanner.nextLine().trim();
            } catch (Exception e) {
                break;
            }

            switch (choice) {

                case "1":

                    if (SessionManager.isSessionActive()) {

                        System.out.println(
                                "A session is already active!");

                        break;
                    }

                    System.out.print("Enter session code: ");

                    String startCode =
                            scanner.nextLine().trim();
                   

                    if (startCode.isEmpty()) {

                        System.out.println(
                                "Session code cannot be empty!");

                        break;
                    }
                    
                    AttendanceManager.clearSessionAttendance(startCode);

                    if (SessionManager.startSession(startCode)) {

                        System.out.println(
                                "Attendance session started!");

                        ClientManager.broadcast(
                                "SESSION_STARTED|"
                                + startCode + "|");
                    }

                    break;

                case "2":

                    if (!SessionManager.isSessionActive()) {

                        System.out.println(
                                "No active session!");

                        break;
                    }

                    String endCode =
                            SessionManager.getActiveSessionCode();

                    // Notify all clients before ending the session.
                    ClientManager.broadcast(
                            "SESSION_ENDED|" + endCode + "|");

                    SessionManager.endSession();

                    System.out.println(
                            "Attendance session ended!");

                    break;

                case "3":

                    if (!SessionManager.isSessionActive()) {

                        System.out.println(
                                "No active attendance session!");

                        break;
                    }

                    String currentCode =
                            SessionManager.getActiveSessionCode();

                    int attendanceCount =
                            AttendanceManager.getAttendanceCount(
                                    currentCode);

                    System.out.println(
                            "\n--- Attendance Statistics ---");

                    System.out.println(
                            "Session Code: " + currentCode);

                    System.out.println(
                            "Total Students: " + attendanceCount);

                    break;

                case "4":

                    System.out.println(
                            "\n--- Connection Statistics ---");

                    System.out.println(
                            "Connected Clients: "
                            + ClientManager.getConnectedClientCount());

                    break;

                default:

                    System.out.println("Invalid option!");
            }
        }
    }
}
