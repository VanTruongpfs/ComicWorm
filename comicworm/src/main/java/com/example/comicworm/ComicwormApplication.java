package com.example.comicworm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@EnableAsync
@SpringBootApplication
public class ComicwormApplication {

	public static void main(String[] args) {
		SpringApplication.run(ComicwormApplication.class, args);
	}

}
