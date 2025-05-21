// Background.jsx
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const Background = () => {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setRotation((r) => (r + 1) % 360), 50);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {/* Shape to the left */}
      <motion.div
        className="absolute left-0 top-1/2 transform -translate-y-1/2 z-0 hidden lg:block"
        style={{
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: `conic-gradient(from ${rotation}deg, rgba(251,146,60,0.1), rgba(251,146,60,0.3), rgba(251,146,60,0.1))`,
        }}
        animate={{ opacity: [0.6, 0.8, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "reverse" }}
      />

      {/* Shape center */}
      <motion.div
        className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0"
        style={{
          width: "450px",
          height: "450px",
          borderRadius: "50%",
          background: `conic-gradient(from ${rotation}deg, rgba(251,146,60,0.1), rgba(251,146,60,0.3), rgba(251,146,60,0.1))`,
        }}
        animate={{ opacity: [0.6, 0.8, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "reverse" }}
      />

      {/* Shape to the right */}
      <motion.div
        className="absolute right-0 top-1/4 z-0 hidden lg:block"
        style={{
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: `conic-gradient(from ${
            360 - rotation
          }deg, rgba(251,146,60,0.1), rgba(251,146,60,0.3), rgba(251,146,60,0.1))`,
        }}
        animate={{ opacity: [0.5, 0.7, 0.5] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          repeatType: "reverse",
          delay: 1,
        }}
      />
    </>
  );
};

export default Background;
