package com.example.comicworm.service.ai;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Local Ollama auto-start for the chatbot; the server URL and model come from spring.ai.openai.*. */
@Component
@ConfigurationProperties(prefix = "app.chatbot.ollama")
@Getter
@Setter
public class ChatbotOllamaProperties {
    private boolean autoStart = false;
    /** Optional path to ollama(.exe); blank searches PATH and the default Windows install folder. */
    private String executable = "";
    /** Folder holding Modelfile and the .gguf, relative to the backend folder unless absolute. */
    private String modelDirectory = "chatbot";
    /** Optional backend folder; blank uses the process working directory. */
    private String workingDirectory = "";
    private int startupTimeoutSeconds = 60;
    private int createTimeoutSeconds = 600;
    /** Load the model into memory after startup so the first chat message is fast. */
    private boolean warmUp = true;
}
