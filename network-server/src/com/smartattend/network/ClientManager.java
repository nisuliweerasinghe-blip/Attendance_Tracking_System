package com.smartattend.network;

import java.io.PrintWriter;
import java.net.Socket;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class ClientManager {

    private static class ClientInfo {

        PrintWriter output;
        String role;

        ClientInfo(PrintWriter output, String role) {
            this.output = output;
            this.role = role;
        }
    }

    private static final Map<Socket, ClientInfo> clients =
            new ConcurrentHashMap<>();

    public static void addClient(
            Socket socket, PrintWriter output, String role) {

        clients.put(socket, new ClientInfo(output, role));

        System.out.println("Client connected!");
        System.out.println(
                "Currently connected clients: " + clients.size());

        broadcastToRole(
                "LECTURER",
                "CONNECTED_CLIENTS|" + clients.size());
    }

    public static void removeClient(Socket socket) {

        if (clients.remove(socket) != null) {

            System.out.println("Client disconnected.");

            System.out.println(
                    "Currently connected clients: " + clients.size());

            broadcastToRole(
                    "LECTURER",
                    "CONNECTED_CLIENTS|" + clients.size());
        }
    }

    public static void sendToClient(
            Socket socket, String message) {

        ClientInfo client = clients.get(socket);

        if (client != null) {
            send(client.output, message);
        }
    }

    public static void broadcast(String message) {

        for (ClientInfo client : clients.values()) {
            send(client.output, message);
        }
    }

    public static void broadcastToRole(
            String role, String message) {

        for (ClientInfo client : clients.values()) {

            if (client.role.equalsIgnoreCase(role)) {
                send(client.output, message);
            }
        }
    }

    private static void send(
            PrintWriter output, String message) {

        synchronized (output) {
            output.println(message);

            if (output.checkError()) {
                System.out.println(
                        "Failed to send message to a client.");
            }
        }
    }

    public static int getConnectedClientCount() {
        return clients.size();
    }
}
