FROM caddy:2.11.9-alpine AS proxy
FROM maven:3.9.11-eclipse-temurin-21 AS build
ARG SERVICE
WORKDIR /build
COPY services/${SERVICE}/pom.xml ./pom.xml
RUN mvn -ntp -DskipTests dependency:go-offline
COPY services/${SERVICE}/src ./src
RUN mvn -ntp -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S inko && adduser -S inko -G inko     && mkdir -p /var/lib/inko/covers     && chown inko:inko /var/lib/inko/covers     && chmod 750 /var/lib/inko/covers
COPY --from=build /build/target/*.jar /app/app.jar
USER inko
COPY --from=proxy /usr/bin/caddy /usr/local/bin/caddy
COPY --chmod=555 infra/render/start.sh /usr/local/bin/start-inko
CMD ["/usr/local/bin/start-inko"]
