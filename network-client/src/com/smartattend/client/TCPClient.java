package com.smartattend.client;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;
import java.util.Scanner;
import java.util.concurrent.atomic.AtomicBoolean;

public class TCPClient {

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

            System.out.println("Connected to SmartAttend Server!");

            System.out.println("Server: " + input.readLine());

            // Identify as a student
            output.println("ROLE|STUDENT");

            Thread receiveThread = new Thread(() -> {

                try {

                    String message;

                    while (running.get()
                            && (message = input.readLine()) != null) {

                        if (message.equals("PONG")) {
                            continue;
                        }

                        System.out.println(
                                "\n[SERVER] " + message);
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

            // Heartbeat thread
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

            // Student menu
            while (running.get()) {

                System.out.println(
                        "\n--- SmartAttend Student Menu ---");

                System.out.println("1. Submit Attendance");
                System.out.println("2. Disconnect");

                System.out.print("Select option: ");

                String choice = scanner.nextLine().trim();

                if (choice.equals("1")) {

                    System.out.print("Enter student name: ");

                    String studentName =
                            scanner.nextLine().trim();

                    System.out.print("Enter session code: ");

                    String sessionCode =
                            scanner.nextLine().trim();

                    if (studentName.isEmpty()
                            || sessionCode.isEmpty()) {

                        System.out.println(
                                "Please enter all details.");

                        continue;
                    }

                    synchronized (output) {

                        output.println(
                                "ATTENDANCE|"
                                + sessionCode + "|"
                                + studentName);
                    }

                } else if (choice.equals("2")) {

                    synchronized (output) {
                        output.println("EXIT");
                    }

                    running.set(false);
                    socket.close();

                    System.out.println(
                            "Disconnected from server.");

                    break;

                } else {

                    System.out.println("Invalid option!");
                }
            }

        } catch (IOException e) {

            System.out.println(
                    "Client Error: " + e.getMessage());
        }
    }
}
