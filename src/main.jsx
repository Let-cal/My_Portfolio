import { Provider } from "@/components/ui/provider";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // Import BrowserRouter
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import Home from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider>
        <Home />
      </Provider>
    </BrowserRouter>
  </React.StrictMode>
);
