FROM maven:3.9.11-eclipse-temurin-21 AS build
ARG SERVICE
WORKDIR /build
COPY services/${SERVICE}/pom.xml ./pom.xml
RUN mvn -ntp -DskipTests dependency:go-offline
COPY services/${SERVICE}/src ./src
RUN mvn -ntp -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S inko && adduser -S inko -G inko
COPY --from=build /build/target/*.jar /app/app.jar
USER inko
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
