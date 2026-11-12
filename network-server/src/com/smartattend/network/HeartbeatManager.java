package com.smartattend.network;

import java.net.Socket;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class HeartbeatManager {

    private static final Map<Socket, Long> lastHeartbeat =
            new ConcurrentHashMap<>();

    private static final long TIMEOUT = 35000;

    public static void registerClient(Socket socket) {
        lastHeartbeat.put(socket, System.currentTimeMillis());
    }

    public static void updateHeartbeat(Socket socket) {
        lastHeartbeat.put(socket, System.currentTimeMillis());
    }

    public static void removeClient(Socket socket) {
        lastHeartbeat.remove(socket);
    }

    public static void checkInactiveClients() {

        long currentTime = System.currentTimeMillis();

        for (Map.Entry<Socket, Long> entry :
                lastHeartbeat.entrySet()) {

            Socket socket = entry.getKey();

            long lastTime = entry.getValue();

            if (currentTime - lastTime > TIMEOUT) {

                // Remove first to avoid repeated timeout messages.
                if (lastHeartbeat.remove(socket, lastTime)) {

                    System.out.println(
                            "Client heartbeat timeout: "
                            + socket.getInetAddress());

                    try {
                        socket.close();
                    } catch (Exception e) {
                        System.out.println(
                                "Error closing inactive client.");
                    }
                }
            }
        }
    }
}
