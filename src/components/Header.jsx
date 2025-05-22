import { useMediaQuery } from "@mui/material";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import AboutDialog from "./pages/About/AboutDialog";
import SocialIcons from "./SocialIcons";
import MobileSummaryModal from "./ui/mobile_summary_modal";

// Register the ScrollToPlugin with GSAP
gsap.registerPlugin(ScrollToPlugin);

const Header = ({ aboutData }) => {
  // State for mobile drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // State for About dialog
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  // Track active section
  const [activeSection, setActiveSection] = useState("home");
  // Refs for animation elements
  const headerRef = useRef(null);
  const navItemsRef = useRef([]);
  const activeIndicatorRef = useRef(null);

  // Media query for responsive design
  const isMobile = useMediaQuery("(max-width:768px)");

  // Define navigation items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const navItems = [
    { name: "Home", id: "home" },
    { name: "About", id: "about" },
    { name: "Core Skills", id: "core-skills" },
    { name: "Projects", id: "projects" },
    { name: "Why Me", id: "why-hire-me" },
    { name: "Certificates", id: "certificates" },
    { name: "Resume", id: "resume" },
  ];

  // Intersection Observer to update active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3 } // Adjust threshold as needed
    );

    // Observe all sections
    const sections = [
      "home",
      "core-skills",
      "projects",
      "certificates",
      "why-hire-me",
    ];

    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => {
      sections.forEach((id) => {
        const element = document.getElementById(id);
        if (element) observer.unobserve(element);
      });
    };
  }, []);

  // Header entrance animation
  useEffect(() => {
    const tl = gsap.timeline();

    tl.fromTo(
      headerRef.current,
      { y: -100, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
      }
    );

    tl.fromTo(
      navItemsRef.current,
      { y: -20, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.1,
        duration: 0.5,
        ease: "power2.out",
      },
      "-=0.5"
    );

    return () => tl.kill();
  }, []);

  // Update active indicator position
  useEffect(() => {
    if (
      !isMobile &&
      activeIndicatorRef.current &&
      navItemsRef.current.length > 0
    ) {
      const activeIndex = navItems.findIndex(
        (item) => item.id === activeSection
      );
      if (activeIndex >= 0 && navItemsRef.current[activeIndex]) {
        const activeElement = navItemsRef.current[activeIndex];

        gsap.to(activeIndicatorRef.current, {
          x: activeElement.offsetLeft,
          width: activeElement.offsetWidth,
          duration: 0.5,
          ease: "power2.inOut",
        });
      }
    }
  }, [activeSection, isMobile, navItems]);

  // Handle navigation click
  const handleNavClick = (id) => {
    // Handle special cases
    if (id === "about") {
      // Debug aboutData
      console.log("About data:", aboutData);

      // Kiểm tra tính hợp lệ của aboutData một cách kỹ lưỡng hơn
      if (
        aboutData &&
        aboutData.title &&
        aboutData.description &&
        Array.isArray(aboutData.description) &&
        aboutData.profile &&
        aboutData.profile.image &&
        aboutData.profile.name &&
        aboutData.profile.role &&
        aboutData.profile.email &&
        aboutData.profile.address
      ) {
        // Use different components based on screen size
        if (isMobile) {
          setShowAboutModal(true);
        } else {
          setShowAboutDialog(true);
        }
      } else {
        console.error("AboutData is incomplete:", aboutData);
        // Log chi tiết về thuộc tính nào bị thiếu
        const missingProps = [];
        if (!aboutData) missingProps.push("aboutData (undefined)");
        else {
          if (!aboutData.title) missingProps.push("title");
          if (!aboutData.description) missingProps.push("description");
          else if (!Array.isArray(aboutData.description))
            missingProps.push("description (not an array)");
          if (!aboutData.profile) missingProps.push("profile");
          else {
            if (!aboutData.profile.image) missingProps.push("profile.image");
            if (!aboutData.profile.name) missingProps.push("profile.name");
            if (!aboutData.profile.role) missingProps.push("profile.role");
            if (!aboutData.profile.email) missingProps.push("profile.email");
            if (!aboutData.profile.address)
              missingProps.push("profile.address");
          }
        }
        console.error("Missing properties:", missingProps);
      }
      return;
    }

    if (id === "resume") {
      window.open("/My_CV.pdf", "_blank");
      return;
    }

    // Handle regular section scrolling
    const targetElement = document.getElementById(id);
    if (targetElement) {
      // Close mobile menu if open
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
      }

      // For active indicator animation
      setActiveSection(id);

      // Custom scroll animation with GSAP
      gsap.to(window, {
        duration: 1.2,
        scrollTo: {
          y: targetElement,
          offsetY: 80, // Adjust for header height
          autoKill: false,
        },
        ease: "power3.inOut",
        onStart: () => {
          // Optional: Add visual indicator that we're scrolling
          const indicator = document.createElement("div");
          indicator.style.cssText = `
            position: fixed;
            z-index: 9999;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(255, 153, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
          `;

          // Add an icon or text inside
          indicator.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff9900" stroke-width="2">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>`;

          document.body.appendChild(indicator);

          // Animate the indicator
          gsap.fromTo(
            indicator,
            { scale: 0, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
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
        },
      });
    }
  };

  return (
    <>
      {/* Desktop & Mobile Header */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 flex flex-col pt-4 pb-4 px-6 bg-white/90 backdrop-blur-md shadow-lg w-full items-center transition-all duration-300"
      >
        <nav className="flex w-full max-w-7xl items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <span className="text-xl font-bold text-orange-500">Portfolio</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center relative">
            {/* Active indicator background pill - animated */}
            <div
              ref={activeIndicatorRef}
              className="absolute h-10 bg-orange-500/20 rounded-full -z-10 transition-transform"
              style={{ left: 0, width: "0px" }}
            />

            {/* Navigation Items */}
            <div className="flex gap-1 items-center">
              {navItems.map((item, index) => (
                <button
                  key={index}
                  ref={(el) => (navItemsRef.current[index] = el)}
                  onClick={() => handleNavClick(item.id, index)}
                  className={`
                    relative px-4 py-2 text-sm font-medium rounded-full
                    transition duration-300 ease-out
                    ${
                      activeSection === item.id
                        ? "text-orange-600"
                        : "text-gray-700 hover:text-orange-500"
                    }
                  `}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* Social Icons */}
          <div className="hidden md:flex">
            <SocialIcons />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden flex items-center"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <div className="w-6 flex flex-col gap-1.5">
              <span
                className={`block h-0.5 bg-gray-800 transition-all duration-300 ease-out ${
                  mobileMenuOpen ? "w-6 translate-y-2 rotate-45" : "w-6"
                }`}
              />
              <span
                className={`block h-0.5 bg-gray-800 transition-all duration-300 ease-out ${
                  mobileMenuOpen ? "opacity-0" : "w-4 ml-auto"
                }`}
              />
              <span
                className={`block h-0.5 bg-gray-800 transition-all duration-300 ease-out ${
                  mobileMenuOpen
                    ? "w-6 -translate-y-2 -rotate-45"
                    : "w-5 ml-auto"
                }`}
              />
            </div>
          </button>
        </nav>
      </header>

      {/* Mobile Navigation Drawer */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden
          transition-opacity duration-300 ease-in-out
          ${mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div
          className={`
            absolute right-0 top-0 bottom-0 w-64 bg-white p-6
            transform transition-transform duration-300 ease-in-out shadow-xl
            ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col h-full">
            <div className="flex justify-end mb-8">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {navItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleNavClick(item.id, index)}
                  className={`
                    py-3 px-4 text-left rounded-lg 
                    transition duration-200 ease-in-out
                    ${
                      activeSection === item.id
                        ? "bg-orange-100 text-orange-600 font-medium"
                        : "text-gray-800 hover:bg-gray-100"
                    }
                  `}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t">
              <SocialIcons />
            </div>
          </div>
        </div>
      </div>

      {/* About Section Modal (mobile) */}
      {showAboutModal && aboutData && (
        <MobileSummaryModal
          onClose={() => setShowAboutModal(false)}
          isAboutSection={true}
          aboutData={aboutData}
        />
      )}

      {/* About Section Dialog (desktop) */}
      {showAboutDialog && aboutData && (
        <AboutDialog
          onClose={() => setShowAboutDialog(false)}
          aboutData={aboutData}
        />
      )}
    </>
  );
};

Header.propTypes = {
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

export default Header;
