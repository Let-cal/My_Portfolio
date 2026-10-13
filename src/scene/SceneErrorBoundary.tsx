"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; onError: (error: unknown) => void };

/**
 * Keeps a failed 3D layer (renderer creation error, lost chunk fetch) from reaching the route error
 * boundary and replacing the page. It renders nothing and tells the parent, which falls back to the static image.
 */
export class SceneErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
