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
    object-position: center 18%;
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
</style>

<div class="contact-card">
  <img src="{{ '/assets/img/prof_pic.jpg' | relative_url }}" class="profile rounded-circle" alt="Rodrigo Córdova Rosado" />

  <h1>Rodrigo Córdova Rosado</h1>
  <p class="tagline">Postdoctoral Fellow · Center for Astrophysics | Harvard &amp; Smithsonian</p>

  <div class="contact-buttons">
    <a class="btn btn-outline-primary btn-lg" href="mailto:{{ site.email | encode_email }}">
      <i class="fas fa-envelope"></i>&nbsp; Email me
    </a>
    <a class="btn btn-outline-secondary btn-lg" href="{{ '/' | relative_url }}">
      <i class="fas fa-home"></i>&nbsp; Home
    </a>
  </div>

  <div class="social">
    {% include social.html %}
  </div>
</div>
