import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import SocialIcons from "./SocialIcons";

// Register the ScrollToPlugin with GSAP
gsap.registerPlugin(ScrollToPlugin);

const Footer = ({ aboutData }) => {
  // State to track active hover item
  const [hoverItem, setHoverItem] = useState(null);
  // Ref for footer element
  const footerRef = useRef(null);
  // Refs for animated elements
  const contentRef = useRef(null);
  const navItemsRef = useRef([]);
  const backToTopRef = useRef(null);
  const copyrightRef = useRef(null);

  // Define navigation items - matching your header
  const navItems = [
    { name: "Home", id: "home" },
    { name: "About", id: "about" },
    { name: "Core Skills", id: "core-skills" },
    { name: "Projects", id: "projects" },
    { name: "Why Me", id: "why-hire-me" },
    { name: "Certificates", id: "certificates" },
    { name: "Resume", id: "resume" },
  ];

  // Animation for footer entrance
  useEffect(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: footerRef.current,
        start: "top bottom-=100",
        toggleActions: "play none none none",
      },
    });

    // Animate the main footer background
    tl.fromTo(
      footerRef.current,
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
    );

    // Animate content sections
    tl.fromTo(
      contentRef.current.children,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: "power2.out",
      },
      "-=0.4"
    );

    // Animate nav items
    tl.fromTo(
      navItemsRef.current,
      { opacity: 0, x: -20 },
      {
        opacity: 1,
        x: 0,
        stagger: 0.05,
        duration: 0.5,
        ease: "power2.out",
      },
      "-=0.4"
    );

    // Animate back to top button
    tl.fromTo(
      backToTopRef.current,
      { opacity: 0, scale: 0.8 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.7)",
      },
      "-=0.3"
    );

    // Animate copyright text
    tl.fromTo(
      copyrightRef.current,
      { opacity: 0 },
      { opacity: 0.7, duration: 0.5 },
      "-=0.2"
    );

    return () => {
      // Clean up animation
      tl.kill();
    };
  }, []);

  // Handle navigation click - similar to your header component logic
  const handleNavClick = (id) => {
    // Handle special cases
    if (id === "about") {
      if (
        aboutData &&
        aboutData.title &&
        aboutData.description &&
        Array.isArray(aboutData.description) &&
        aboutData.profile
      ) {
        // Open about dialog/modal based on screen size
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          // Dispatch event for mobile modal
          window.dispatchEvent(new CustomEvent("openAboutModal"));
        } else {
          // Dispatch event for desktop dialog
          window.dispatchEvent(new CustomEvent("openAboutDialog"));
        }
      } else {
        console.error("AboutData is incomplete:", aboutData);
      }
      return;
    }

    if (id === "resume") {
      window.open("../../public/My_CV.pdf", "_blank");
      return;
    }

    // Handle regular section scrolling
    const targetElement = document.getElementById(id);
    if (targetElement) {
      // Create and show scroll indicator
      const indicator = document.createElement("div");
      indicator.className = "scroll-marker";
      indicator.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff9900" stroke-width="2">
        <path d="M12 5v14M19 12l-7 7-7-7"/>
      </svg>`;
      document.body.appendChild(indicator);

      // Animate the indicator
      gsap.fromTo(
        indicator,
        { scale: 0, opacity: 0, className: "scroll-marker" },
        {
          scale: 1,
          opacity: 1,
          className: "scroll-marker active",
          duration: 0.3,
          onComplete: () => {
            gsap.to(indicator, {
              opacity: 0,
              scale: 1.5,
              duration: 0.6,
              delay: 0.6,
              onComplete: () => document.body.removeChild(indicator),
            });
          },
        }
      );

      // Smooth scroll to target section
      gsap.to(window, {
        duration: 1.2,
        scrollTo: {
          y: targetElement,
          offsetY: 80, // Adjust for header height
          autoKill: false,
        },
        ease: "power3.inOut",
      });
    }
  };

  // Back to top function
  const scrollToTop = () => {
    // Animated back to top using GSAP
    gsap.to(window, {
      duration: 1.5,
      scrollTo: 0,
      ease: "power4.inOut",
      onStart: () => {
        // Rocket animation effect
        gsap.to(backToTopRef.current, {
          y: -15,
          rotation: -5,
          duration: 0.3,
          ease: "power2.in",
          onComplete: () => {
            gsap.to(backToTopRef.current, {
              y: 0,
              rotation: 0,
              duration: 0.8,
              delay: 0.7,
              ease: "elastic.out(1, 0.3)",
            });
          },
        });
      },
    });
  };

  return (
    <footer
      ref={footerRef}
      className="relative bg-white border-t border-gray-100 shadow-md pt-12 pb-6 px-6 overflow-hidden"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full bg-gradient-to-br from-orange-300 to-orange-500" />
        <div className="absolute -left-24 -bottom-24 w-96 h-96 rounded-full bg-gradient-to-tr from-orange-300 to-orange-600" />
      </div>

      {/* Content grid */}
      <div
        ref={contentRef}
        className="relative z-10 max-w-7xl mx-auto grid md:grid-cols-3 gap-8"
      >
        {/* Brand and About column */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">LC</span>
            </div>
            <h3 className="text-xl font-bold text-orange-500">Portfolio</h3>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed">
            Passionate Front-End Developer specializing in creating engaging and
            responsive user interfaces with React, TypeScript, and modern CSS
            frameworks.
          </p>

          <div className="pt-2">
            <SocialIcons />
          </div>
        </div>

        {/* Navigation links column */}
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Quick Links
          </h3>
          <nav className="grid grid-cols-2 gap-2">
            {navItems.map((item, index) => (
              <button
                key={index}
                ref={(el) => (navItemsRef.current[index] = el)}
                onClick={() => handleNavClick(item.id)}
                onMouseEnter={() => setHoverItem(item.id)}
                onMouseLeave={() => setHoverItem(null)}
                className={`
                  flex items-center text-left text-sm
                  transition duration-300 ease-out 
                  ${
                    hoverItem === item.id
                      ? "translate-x-1 text-orange-500"
                      : "text-gray-700"
                  }
                `}
              >
                <div
                  className={`w-1 h-1 rounded-full ${
                    hoverItem === item.id ? "bg-orange-500" : "bg-gray-400"
                  } mr-2 transition-colors duration-300`}
                ></div>
                {item.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Contact column */}
        <div className="flex flex-col space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-0">
            Get In Touch
          </h3>

          <div className="text-sm text-gray-600">
            <p className="mb-1">Email: letcal2003@gmail.com</p>
            <p className="mb-1">Phone: 0964 829 558</p>
            <p>Location: Ho Chi Minh City, Vietnam</p>
          </div>

          <button
            onClick={scrollToTop}
            ref={backToTopRef}
            className="self-start mt-2 flex items-center gap-2 text-orange-500 font-medium bg-orange-50 px-4 py-2 rounded-full hover:bg-orange-100 transition-colors group"
          >
            <svg
              className="w-4 h-4 group-hover:-translate-y-1 transition-transform duration-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
            Back to top
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-7xl mx-auto mt-10 border-t border-gray-200 pt-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p ref={copyrightRef} className="text-sm text-gray-500">
            © {new Date().getFullYear()} My Portfolio - Letcal. All rights
            reserved.
          </p>

          <div className="mt-4 md:mt-0 flex gap-4 text-xs text-gray-500">
            <a href="#" className="hover:text-orange-500 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-orange-500 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

Footer.propTypes = {
  aboutData: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.arrayOf(PropTypes.string).isRequired,
    profile: PropTypes.shape({
      image: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      role: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      address: PropTypes.string.isRequired,
      linkFace: PropTypes.string,
      linkInstagram: PropTypes.string,
      linkLinkedln: PropTypes.string,
      linkGit: PropTypes.string,
    }).isRequired,
    bgMode: PropTypes.oneOf(["light", "dark"]),
  }).isRequired,
};

export default Footer;
