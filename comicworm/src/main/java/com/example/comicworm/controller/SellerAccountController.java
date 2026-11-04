package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.SellerApplicationForm;
import com.example.comicworm.dto.response.SellerApplicationDTO;
import com.example.comicworm.service.account.SellerApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

/** "Đăng ký Người bán": buyers submit a seller application (sample CCCD data) and follow its review status. */
@Controller
public class SellerAccountController {
    private static final String VIEW = "view/user/html/seller-upgrade";
    private static final String SELLER_HOME = "redirect:/seller/html/index.html";
    private static final String SELF = "redirect:/user/seller-upgrade";

    private final SellerApplicationService applications;

    public SellerAccountController(SellerApplicationService applications) {
        this.applications = applications;
    }

    @GetMapping("/user/seller-upgrade")
    public String registrationPage(@AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(defaultValue = "false") boolean csrfExpired, Model model) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (user.isSeller()) return SELLER_HOME;
        SellerApplicationDTO latest = applications.latestFor(user.getId()).orElse(null);
        model.addAttribute("form", latest != null && "REJECTED".equals(latest.status())
                ? new SellerApplicationForm(latest.idNumber(), latest.idFullName(), latest.idDateOfBirth(),
                        latest.idIssueDate(), latest.idIssuePlace())
                : SellerApplicationForm.sample());
        return render(user, latest, csrfExpired, model);
    }

    @PostMapping("/user/seller-upgrade")
    public String submit(@AuthenticationPrincipal CustomUserDetails user,
            @Valid @ModelAttribute("form") SellerApplicationForm form, BindingResult errors, Model model) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (user.isSeller()) return SELLER_HOME;
        SellerApplicationDTO latest = applications.latestFor(user.getId()).orElse(null);
        if (errors.hasErrors()) return render(user, latest, false, model);
        try {
            applications.submit(user.getId(), form);
        } catch (ResponseStatusException e) {
            if (e.getStatusCode().value() != HttpStatus.BAD_REQUEST.value()) return SELF;
            errors.reject("invalid", e.getReason());
            return render(user, latest, false, model);
        }
        return SELF;
    }

    private String render(CustomUserDetails user, SellerApplicationDTO latest, boolean csrfExpired, Model model) {
        model.addAttribute("fullName", user.getUser().getFullName());
        model.addAttribute("sellerApplication", latest);
        model.addAttribute("csrfExpired", csrfExpired);
        return VIEW;
    }
}
