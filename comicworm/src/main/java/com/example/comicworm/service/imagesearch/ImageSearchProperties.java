package com.example.comicworm.service.imagesearch;

import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.image-search")
@Getter
@Setter
public class ImageSearchProperties {
    private boolean enabled = false;
    private boolean autoStart = true;
    /** Optional backend directory and Python executable; defaults use the project's .venv. */
    private String workingDirectory = "";
    private String pythonExecutable = "";
    private int startupTimeoutSeconds = 180;
    private String serviceUrl = "http://127.0.0.1:8091";
    private String modelName = "clip-vit-b32-f41c383-rgb-v1";
    private int dimensions = 512;
    private int batchSize = 10;
    private List<String> allowedImageHosts = List.of("res.cloudinary.com");
}
