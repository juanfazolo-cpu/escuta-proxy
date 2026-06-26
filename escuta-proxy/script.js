(function () {
  const whatsappButtons = document.querySelectorAll("[data-whatsapp-cta]");

  whatsappButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const eventPayload = {
        event: "whatsapp_budget_click",
        cta_label: button.dataset.ctaLabel || "sem-label",
        page_location: window.location.href,
      };

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(eventPayload);

      if (typeof window.gtag === "function") {
        window.gtag("event", "whatsapp_budget_click", {
          event_category: "lead",
          event_label: eventPayload.cta_label,
          transport_type: "beacon",
        });
      }

      if (window.console && typeof window.console.info === "function") {
        window.console.info("WhatsApp CTA tracked", eventPayload);
      }
    });
  });

  const lightbox = document.getElementById("lightbox");

  if (lightbox) {
    const lightboxImage = lightbox.querySelector(".lightbox-content img");
    const lightboxCaption = lightbox.querySelector(".lightbox-content figcaption");
    const closeButton = lightbox.querySelector(".lightbox-close");
    const galleryCards = document.querySelectorAll("[data-lightbox]");

    function closeLightbox() {
      lightbox.hidden = true;
      lightbox.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function openLightbox(card) {
      const image = card.querySelector("img");
      const caption = card.querySelector("figcaption");

      if (!image) {
        return;
      }

      lightboxImage.src = image.src;
      lightboxImage.alt = image.alt;
      lightboxCaption.textContent = caption ? caption.textContent : image.alt;
      lightbox.hidden = false;
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    galleryCards.forEach((card) => {
      card.addEventListener("click", () => openLightbox(card));
    });

    closeButton.addEventListener("click", closeLightbox);

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !lightbox.hidden) {
        closeLightbox();
      }
    });
  }

  const keychainCarousel = document.querySelector("[data-keychain-carousel]");

  if (keychainCarousel) {
    const slides = Array.from(keychainCarousel.querySelectorAll(".keychain-carousel-slide"));
    const caption = keychainCarousel.querySelector(".keychain-carousel-caption");
    const dotsContainer = keychainCarousel.querySelector(".keychain-carousel-dots");
    let activeIndex = 0;
    let carouselTimer;

    slides.forEach((slide, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "keychain-carousel-dot" + (index === 0 ? " is-active" : "");
      dot.setAttribute("aria-label", `Mostrar modelo ${index + 1}`);
      dot.addEventListener("click", () => {
        showSlide(index);
        restartCarousel();
      });
      dotsContainer.appendChild(dot);
    });

    const dots = Array.from(dotsContainer.querySelectorAll(".keychain-carousel-dot"));

    function showSlide(index) {
      activeIndex = index;
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle("is-active", slideIndex === index);
      });
      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("is-active", dotIndex === index);
      });
      if (caption) {
        caption.textContent = slides[index].dataset.caption || "";
      }
    }

    function nextSlide() {
      showSlide((activeIndex + 1) % slides.length);
    }

    function restartCarousel() {
      window.clearInterval(carouselTimer);
      carouselTimer = window.setInterval(nextSlide, 2000);
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReducedMotion && slides.length > 1) {
      restartCarousel();
    }
  }
})();
