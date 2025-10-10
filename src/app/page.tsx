"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import "./styles.css";

const ThreeCanvas = dynamic(() => import("../components/ThreeCanvas"), {
  ssr: false,
});

export default function Page() {
  return (
    <>
      <div id="model-viewer">
        <ThreeCanvas />
      </div>

      <div className="container">
        <nav className="navbar">
          <div className="logo">BAMM</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#models">Models</a>
            <a href="#contact">Contact</a>
          </div>
        </nav>

        <main>
          <section className="hero">
            <div className="hero-content">
              <h1>BAMM</h1>
              <h2>3D Model Generation</h2>
              <p>
                Experience the future of 3D modeling with our cutting-edge
                technology. Transform your ideas into stunning 3D models with
                unprecedented ease and quality.
              </p>
              <Link href="/dashboard">
                <button className="cta-button">Get Started</button>
              </Link>
            </div>
            <div className="model-info">
              <span className="model-name">Loading...</span>
              <span className="model-description">
                Experience our high-quality 3D models
              </span>
            </div>
          </section>

          <section id="features" className="features">
            <h2>Key Features</h2>
            <div className="feature-grid">
              <div className="feature-card">
                <h3>High Quality</h3>
                <p>Photorealistic 3D models with detailed textures and animations</p>
              </div>
              <div className="feature-card">
                <h3>Easy Integration</h3>
                <p>Seamlessly integrate our models into your projects</p>
              </div>
              <div className="feature-card">
                <h3>Customizable</h3>
                <p>Modify and customize models to fit your needs</p>
              </div>
              <div className="feature-card">
                <h3>Optimized</h3>
                <p>Performance-optimized models for smooth rendering</p>
              </div>
            </div>
          </section>

          <section id="models" className="models">
            <h2>Featured Models</h2>
            <div className="model-grid">
              <div className="model-card">
                <h3>King</h3>
                <p>Majestic character with dynamic animations</p>
              </div>
              <div className="model-card">
                <h3>Venom</h3>
                <p>Powerful and menacing presence</p>
              </div>
              <div className="model-card">
                <h3>Human Torch</h3>
                <p>Flame-powered hero with spectacular effects</p>
              </div>
              <div className="model-card">
                <h3>Batman</h3>
                <p>Dark knight with iconic poses</p>
              </div>
            </div>
          </section>

          <section id="contact" className="contact">
            <h2>Get in Touch</h2>
            <p>Ready to transform your ideas into 3D reality?</p>
            <button className="cta-button">Contact Us</button>
          </section>
        </main>

        <footer>
          <div className="footer-content">
            <div className="footer-logo">BAMM</div>
            <div className="footer-links">
              <a href="#features">Features</a>
              <a href="#models">Models</a>
              <a href="#contact">Contact</a>
            </div>
            <div className="footer-social">
              <a href="#" className="social-link">
                Twitter
              </a>
              <a href="#" className="social-link">
                LinkedIn
              </a>
              <a href="#" className="social-link">
                GitHub
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 BAMM. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
