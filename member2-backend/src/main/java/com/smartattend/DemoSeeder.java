package com.smartattend;

import com.smartattend.repo.Repo;
import com.smartattend.util.Codes;
import java.net.NetworkInterface;
import java.util.Collections;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/** On startup: ensures demo accounts exist, creates a 2-hour demo session, prints the code and URLs. */
@Component
public class DemoSeeder implements ApplicationRunner {

    private final Repo repo;
    private final BCryptPasswordEncoder encoder;
    private final boolean enabled;
    private final int port;

    public DemoSeeder(Repo repo, BCryptPasswordEncoder encoder,
                      @Value("${smartattend.demo-seed:false}") boolean enabled,
                      @Value("${server.port:4000}") int port) {
        this.repo = repo;
        this.encoder = encoder;
        this.enabled = enabled;
        this.port = port;
    }

    private long ensureUser(String name, String email, String role) {
        return repo.userByEmail(email).map(Repo.User::id).orElseGet(() -> {
            try {
                return repo.insertUser(name, email, encoder.encode("password123"), role, null);
            } catch (DuplicateKeyException e) {
                return repo.userByEmail(email).orElseThrow().id();
            }
        });
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        System.out.println("\nSmartAttend running:\n  Local:   http://localhost:" + port);
        for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
            if (!ni.isUp() || ni.isLoopback()) continue;
            Collections.list(ni.getInetAddresses()).stream()
                    .filter(a -> a instanceof java.net.Inet4Address)
                    .forEach(a -> System.out.println("  Network: http://" + a.getHostAddress() + ":" + port));
        }
        if (!enabled) return;

        long lecturerId = ensureUser("Dr Lecturer", "lecturer@test.com", "lecturer");
        ensureUser("Admin User", "admin@test.com", "admin");

        String code = Codes.generate();
        long now = System.currentTimeMillis();
        repo.insertSession("NET101", "Demo session", code, lecturerId, now, now + 120 * 60_000L);

        System.out.println("\n  Lecturer: lecturer@test.com / password123");
        System.out.println("  Admin:    admin@test.com / password123");
        System.out.println("  Demo session code (valid 2 hours): " + code + "\n");
    }
}
