package com.example.comicworm.controller;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.server.ResponseStatusException;

/** Render the moved templates while retaining existing navigation and fetch URLs. */
@Controller
public class ViewController {

    @GetMapping({"/", "/index.html"})
    public String home() {
        return "view/index";
    }

    @GetMapping("/{area:admin|auth|buyer|exchange|seller|user}/html/{page:[A-Za-z0-9_-]+}.html")
    public String page(@PathVariable("area") String area, @PathVariable("page") String page) {
        return resolve(area + "/html/" + page);
    }

    @GetMapping("/shared/{component:header|footer|sidebar}/{page:[A-Za-z0-9_-]+}.html")
    public String sharedComponent(@PathVariable("component") String component,
                                  @PathVariable("page") String page) {
        return resolve("shared/" + component + "/" + page);
    }

    private String resolve(String path) {
        String view = "view/" + path;
        if (!new ClassPathResource("templates/" + view + ".html").exists()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "View not found");
        }
        return view;
    }
}
