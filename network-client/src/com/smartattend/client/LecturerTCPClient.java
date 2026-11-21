package com.smartattend.client;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;
import java.util.Scanner;
import java.util.concurrent.atomic.AtomicBoolean;

public class LecturerTCPClient {

    private static final String HOST = "localhost";
    private static final int PORT = 6000;

    public static void main(String[] args) {

        AtomicBoolean running = new AtomicBoolean(true);

        try (
            Socket socket = new Socket(HOST, PORT);

            BufferedReader input = new BufferedReader(
                    new InputStreamReader(socket.getInputStream()));

            PrintWriter output = new PrintWriter(
                    socket.getOutputStream(), true);

            Scanner scanner = new Scanner(System.in)
        ) {

            System.out.println(
                    "Connected to SmartAttend Server!");

            System.out.println("Server: " + input.readLine());

            // Identify as a lecturer
            output.println("ROLE|LECTURER");

            Thread receiveThread = new Thread(() -> {

                try {

                    String message;

                    while (running.get()
                            && (message = input.readLine()) != null) {

                        if (message.equals("PONG")) {
                            continue;
                        }

                        if (message.startsWith(
                                "ATTENDANCE_UPDATE|")) {

                            String[] parts =
                                    message.split("\\|", 4);

                            if (parts.length == 4) {

                                System.out.println(
                                        "\n--- New Attendance ---");

                                System.out.println(
                                        "Session: " + parts[1]);

                                System.out.println(
                                        "Student: " + parts[2]);

                                System.out.println(
                                        "Total Attendance: " + parts[3]);
                            }

                        } else {

                            System.out.println(
                                    "\n[SERVER] " + message);
                        }
                    }

                } catch (IOException e) {

                    if (running.get()) {
                        System.out.println(
                                "\nServer connection lost.");
                    }

                } finally {

                    running.set(false);
                }
            });

            receiveThread.setDaemon(true);
            receiveThread.start();

            // Lecturer heartbeat
            Thread heartbeatThread = new Thread(() -> {

                try {

                    while (running.get()
                            && !socket.isClosed()) {

                        synchronized (output) {
                            output.println("PING");
                        }

                        Thread.sleep(10000);
                    }

                } catch (InterruptedException e) {

                    Thread.currentThread().interrupt();
                }
            });

            heartbeatThread.setDaemon(true);
            heartbeatThread.start();

            System.out.println(
                    "\nLecturer monitoring is active.");

            System.out.println(
                    "Use the TCP server console to start "
                    + "and end attendance sessions.");

            System.out.println(
                    "Press ENTER to disconnect.");

            scanner.nextLine();

            running.set(false);

            synchronized (output) {
                output.println("EXIT");
            }

            socket.close();

            System.out.println(
                    "Lecturer disconnected.");

        } catch (IOException e) {

            System.out.println(
                    "Lecturer Client Error: " + e.getMessage());
        }
    }
}
