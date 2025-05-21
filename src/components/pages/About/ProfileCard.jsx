import gsap from "gsap";
import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
import { FaFacebook, FaGithub, FaLinkedin } from "react-icons/fa";
import { MdEmail, MdLocationOn } from "react-icons/md";
import { SiInstagram } from "react-icons/si";
import "./magnetic-glow.css";

const ProfileCard = ({
  image,
  name,
  role,
  email,
  address,
  linkFace,
  linkInstagram,
  linkLinkedln,
  linkGit,
  bgColor,
  textColor,
}) => {
  const cardRef = useRef(null);
  const glowRef = useRef(null);

  // Default colors if not provided
  const cardBg = bgColor || "#111111";
  const textCol = textColor || "#ffffff";

  // Setup GSAP animation on mount
  useEffect(() => {
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
    );

    // Initial opacity for glow effect
    gsap.set(glowRef.current, { opacity: 0 });

    return () => {
      // Cleanup animations
      gsap.killTweensOf(cardRef.current);
    };
  }, []);

  // Handle magnetic glow effect
  const handleMouseMove = (e) => {
    if (!cardRef.current || !glowRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100));

    // Set the CSS variables for position
    glowRef.current.style.setProperty("--x", `${xPercent}%`);
    glowRef.current.style.setProperty("--y", `${yPercent}%`);

    // Animate glow opacity with GSAP for smoother transition
    gsap.to(glowRef.current, { opacity: 1, duration: 0.3 });
  };

  const handleMouseLeave = () => {
    if (!glowRef.current) return;
    gsap.to(glowRef.current, { opacity: 0, duration: 0.5 });
  };

  // Determine glow color based on background (for contrast)
  const glowColor = "rgba(255, 146, 60, 0.5)"; // Orange glow

  return (
    <div
      ref={cardRef}
      className="glow-card rounded-xl overflow-hidden cursor-pointer transition-transform duration-300 h-full"
      style={{
        backgroundColor: cardBg,
        color: textCol,
        transform: "translateZ(0)",
        position: "relative",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glow effect container */}
      <div
        ref={glowRef}
        className="glow-effect absolute inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(circle at var(--x, 50%) var(--y, 50%), ${glowColor} 0%, transparent 55%)`,
          filter: "blur(60px)",
          mixBlendMode: "screen",
          opacity: 0,
        }}
      />

      {/* Card content container */}
      <div className="card-content relative z-10 flex flex-col h-full">
        <div className="profile-content flex flex-col h-full">
          {/* Banner */}
          <div
            className="profile-banner h-20"
            style={{
              background: "linear-gradient(to right, #fb923c, #f97316)",
            }}
          />

          {/* Profile image */}
          <div
            className="profile-img w-24 h-24 rounded-full overflow-hidden mx-auto -mt-12 border-4"
            style={{ borderColor: cardBg }}
          >
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Profile info */}
          <h2 className="text-xl font-semibold mt-4 text-center">{name}</h2>
          <p className="text-center opacity-70 px-6 mb-4">{role}</p>

          {/* Contact information */}
          <div className="px-6 space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm opacity-80">
              <MdEmail className="flex-shrink-0" />
              <span className="truncate">{email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm opacity-80">
              <MdLocationOn className="flex-shrink-0" />
              <span className="truncate">{address}</span>
            </div>
          </div>

          {/* Social links */}
          <div className="mt-auto px-6 pb-6">
            <div className="flex justify-center gap-4">
              <a
                href={linkFace}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-opacity-10 bg-white hover:bg-opacity-20 transition-all"
              >
                <FaFacebook />
              </a>
              <a
                href={linkInstagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-opacity-10 bg-white hover:bg-opacity-20 transition-all"
              >
                <SiInstagram />
              </a>
              <a
                href={linkLinkedln}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-opacity-10 bg-white hover:bg-opacity-20 transition-all"
              >
                <FaLinkedin />
              </a>
              <a
                href={linkGit}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-opacity-10 bg-white hover:bg-opacity-20 transition-all"
              >
                <FaGithub />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

ProfileCard.propTypes = {
  image: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  role: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
  address: PropTypes.string.isRequired,
  linkFace: PropTypes.string,
  linkInstagram: PropTypes.string,
  linkLinkedln: PropTypes.string,
  linkGit: PropTypes.string,
  bgColor: PropTypes.string,
  textColor: PropTypes.string,
};

export default ProfileCard;
