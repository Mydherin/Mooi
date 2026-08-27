package dev.mooi.mic.shared;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/**
 * Transversal aspect: request tracing and access logging.
 *
 * <p>Every request carries a correlation id, propagated to the MDC (rendered by the logging pattern)
 * and echoed back in the {@code X-Correlation-Id} response header.
 */
@Configuration
public class Logging {

    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    public static final String CORRELATION_ID_KEY = "correlationId";

    @Bean
    FilterRegistrationBean<RequestTraceFilter> requestTraceFilter() {
        FilterRegistrationBean<RequestTraceFilter> registration =
                new FilterRegistrationBean<>(new RequestTraceFilter());
        registration.addUrlPatterns("/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    /** Correlation id of the request being served, empty outside a request. */
    public static String currentCorrelationId() {
        String correlationId = MDC.get(CORRELATION_ID_KEY);
        return correlationId != null ? correlationId : "";
    }

    @Slf4j
    static class RequestTraceFilter extends OncePerRequestFilter {

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            String correlationId = correlationId(request);
            MDC.put(CORRELATION_ID_KEY, correlationId);
            response.setHeader(CORRELATION_ID_HEADER, correlationId);
            long startedAt = System.nanoTime();
            try {
                chain.doFilter(request, response);
            } finally {
                long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000L;
                log.info("{} {} -> {} ({} ms)", request.getMethod(), request.getRequestURI(),
                        response.getStatus(), elapsedMs);
                MDC.remove(CORRELATION_ID_KEY);
            }
        }

        private String correlationId(HttpServletRequest request) {
            String header = request.getHeader(CORRELATION_ID_HEADER);
            return header != null && !header.isBlank() ? header : UUID.randomUUID().toString();
        }
    }
}
