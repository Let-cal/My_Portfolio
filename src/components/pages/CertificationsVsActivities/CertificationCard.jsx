import PropTypes from "prop-types";
import { useEffect, useRef } from "react";

export default function CertificationCard({
  name,
  issueDate,
  expirationDate,
  organization,
  credentialId,
  credentialUrl,
  skills,
  description,
}) {
  const cardRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const card = cardRef.current;
    const content = contentRef.current;
    const rotationFactor = 2;

    // Check if it's a touch device
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice && card && content) {
      const handleMouseMove = (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateY = (rotationFactor * (x - centerX)) / centerX;
        const rotateX = (-rotationFactor * (y - centerY)) / centerY;

        content.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        card.style.setProperty("--x", `${(x / rect.width) * 100}%`);
        card.style.setProperty("--y", `${(y / rect.height) * 100}%`);
      };

      const handleMouseLeave = () => {
        content.style.transform = "rotateX(0) rotateY(0)";
        content.style.transition = "transform 0.5s ease";
        setTimeout(() => {
          content.style.transition = "";
        }, 500);
      };

      card.addEventListener("mousemove", handleMouseMove);
      card.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        card.removeEventListener("mousemove", handleMouseMove);
        card.removeEventListener("mouseleave", handleMouseLeave);
      };
    }

    // Add ripple effect to buttons
    const button = card?.querySelector(".card-button");
    if (button) {
      const handleClick = (e) => {
        e.stopPropagation();
        const ripple = document.createElement("span");
        ripple.classList.add("ripple");
        button.appendChild(ripple);

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;

        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
        ripple.classList.add("active");

        setTimeout(() => {
          ripple.remove();
        }, 500);
      };

      button.addEventListener("click", handleClick);

      return () => {
        button.removeEventListener("click", handleClick);
      };
    }
  }, []);

  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  return (
    <div
      ref={cardRef}
      className="card relative h-[400px] rounded-2xl bg-white/5 border border-white/10 shadow-lg backdrop-blur-md cursor-pointer overflow-hidden animate-cardFloat"
      style={{ animationDelay: `${Math.random() * 2}s` }}
    >
      <div
        className="absolute inset-0 bg-gradient-radial from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(255, 255, 255, 0.1) 0%, transparent 50%)",
        }}
      ></div>

      <div
        ref={contentRef}
        className="card-content relative h-full p-6 flex flex-col transform-gpu transition-all duration-500 ease-out"
        style={{ transformStyle: "preserve-3d" }}
      >
        <h2
          className="text-xl font-bold mb-2 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent"
          style={{ transform: "translateZ(20px)" }}
        >
          {name}
        </h2>

        <div
          className="flex flex-wrap gap-1 mb-3"
          style={{ transform: "translateZ(15px)" }}
        >
          <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/80">
            {formatDate(issueDate)}
            {expirationDate && ` - ${formatDate(expirationDate)}`}
          </span>
          <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/80">
            {organization}
          </span>
        </div>

        <p
          className="text-sm text-white/80 mb-4"
          style={{ transform: "translateZ(15px)" }}
        >
          {description}
        </p>

        {skills && skills.length > 0 && (
          <div
            className="flex flex-wrap gap-1 mb-3"
            style={{ transform: "translateZ(15px)" }}
          >
            {skills.map((skill, index) => (
              <span
                key={index}
                className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/80"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        <div
          className="mt-auto flex justify-between items-center"
          style={{ transform: "translateZ(15px)" }}
        >
          <a
            href={credentialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="card-button relative overflow-hidden px-4 py-2 bg-white/10 border border-white/20 rounded-full text-white font-semibold text-sm transition-all hover:bg-white/20 hover:-translate-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            View Credential
          </a>

          {credentialId && (
            <span className="text-xs text-white/60">
              ID: {credentialId.substring(0, 15)}...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
CertificationCard.propTypes = {
  name: PropTypes.string.isRequired,
  issueDate: PropTypes.string.isRequired,
  expirationDate: PropTypes.string,
  organization: PropTypes.string.isRequired,
  credentialId: PropTypes.string,
  credentialUrl: PropTypes.string,
  skills: PropTypes.arrayOf(PropTypes.string),
  description: PropTypes.string,
};
