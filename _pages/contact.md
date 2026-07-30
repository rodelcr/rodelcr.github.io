---
layout: page
permalink: /contact/
title: Rodrigo Córdova Rosado
description: Postdoctoral Fellow · Center for Astrophysics | Harvard & Smithsonian
---

<style>
  .post > .post-header { display: none; }
  .contact-card { text-align: center; padding: 2rem 0 3rem 0; }
  .contact-card img.profile {
    width: 220px;
    height: 220px;
    object-fit: cover;
    object-position: center 8%;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    margin-bottom: 1.5rem;
  }
  .contact-card h1 { margin: 0.5rem 0 0.25rem; }
  .contact-card .tagline {
    color: var(--global-text-color-light);
    margin-bottom: 2rem;
    font-size: 1.05rem;
  }
  .contact-card .contact-buttons { margin: 1.25rem 0 0.5rem; }
  .contact-card .contact-buttons .btn { margin: 0.4rem; }
  .contact-card .social { font-size: 1.6rem; margin-top: 2rem; }
  .contact-card .social a { margin: 0 0.35rem; }
  .contact-card .vcard-note {
    color: var(--global-text-color-light);
    font-size: 0.8rem;
    margin: 0.75rem auto 0;
    max-width: 34ch;
  }
  .contact-card .vcard-note code { font-size: 0.78rem; }
</style>

<!-- The contact-card link deliberately has no `download` attribute: on iOS
     Safari `download` saves the file into Files instead of handing it to
     Contacts, which defeats the point. Letting Safari open it inline is what
     triggers the "Add Contact" sheet. Regenerate the .vcf with bin/make-vcard.sh -->


<div class="contact-card">
  <!-- Served as WebP variants rather than the 4.4 MB original, which is kept
       only as a fallback for browsers without WebP support. Variants are
       committed because jekyll-imagemagick does not run on GitHub Pages;
       regenerate with bin/make-responsive-images.sh -->
  <picture>
    <source media="(max-width: 480px)" srcset="{{ '/assets/img/prof_pic-480.webp' | relative_url }}" />
    <source srcset="{{ '/assets/img/prof_pic-800.webp' | relative_url }}" />
    <img src="{{ '/assets/img/prof_pic.jpg' | relative_url }}" class="profile rounded-circle"
         width="220" height="220" alt="Rodrigo Córdova Rosado" />
  </picture>

  <h1>Rodrigo Córdova Rosado</h1>
  <p class="tagline">Postdoctoral Fellow · Center for Astrophysics | Harvard &amp; Smithsonian</p>

  <div class="contact-buttons">
    <a class="btn btn-outline-primary btn-lg" href="mailto:{{ site.email | encode_email }}">
      <i class="fas fa-envelope"></i>&nbsp; Email me
    </a>
    <a class="btn btn-outline-primary btn-lg"
       href="{{ '/assets/vcard/rodrigo-cordova-rosado.vcf' | relative_url }}"
       type="text/vcard">
      <i class="fas fa-address-card"></i>&nbsp; Save contact card
    </a>
    <a class="btn btn-outline-secondary btn-lg" href="{{ '/' | relative_url }}">
      <i class="fas fa-home"></i>&nbsp; Home
    </a>
  </div>

  <p class="vcard-note">
    Opens in Contacts on iPhone and Android; downloads a <code>.vcf</code> on desktop.
  </p>

  <div class="social">
    {% include social.html %}
  </div>
</div>
