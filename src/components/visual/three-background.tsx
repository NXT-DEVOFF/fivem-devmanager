"use client";

import * as React from "react";
import type * as ThreeTypes from "three";

/**
 * Fond 3D discret (icosaedre filaire + particules) charge a la demande.
 * Aucun asset externe, aucun cookie, aucune requete reseau.
 */
export function ThreeBackground({ className }: { className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let cleanup = () => undefined as void;

    void (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(container.clientWidth, Math.max(container.clientHeight, 1));
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        55,
        container.clientWidth / Math.max(container.clientHeight, 1),
        0.1,
        100,
      );
      camera.position.set(0, 0, 8);

      const geometry = new THREE.IcosahedronGeometry(2.6, 1);
      const material = new THREE.MeshBasicMaterial({
        color: 0x5865f2,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const pointsGeometry = new THREE.BufferGeometry();
      const count = 420;
      const positions = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) {
        positions[index * 3] = (Math.random() - 0.5) * 14;
        positions[index * 3 + 1] = (Math.random() - 0.5) * 9;
        positions[index * 3 + 2] = (Math.random() - 0.5) * 8;
      }
      pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const pointsMaterial = new THREE.PointsMaterial({
        color: 0x8b9cff,
        size: 0.035,
        transparent: true,
        opacity: 0.55,
      });
      const points = new THREE.Points(pointsGeometry, pointsMaterial);
      scene.add(points);

      const pointer = { x: 0, y: 0 };
      const onPointer = (event: PointerEvent) => {
        pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.35;
        pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.25;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      const resize = () => {
        const width = container.clientWidth;
        const height = Math.max(container.clientHeight, 1);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);

      let frame = 0;
      let visible = !document.hidden;
      const onVisibility = () => {
        visible = !document.hidden;
      };
      document.addEventListener("visibilitychange", onVisibility);

      const clock = new THREE.Clock();
      const render = () => {
        frame = requestAnimationFrame(render);
        if (!visible) return;
        const elapsed = reduced ? 0 : clock.getElapsedTime();
        mesh.rotation.x = elapsed * 0.09 + pointer.y;
        mesh.rotation.y = elapsed * 0.14 + pointer.x;
        points.rotation.y = -elapsed * 0.03;
        renderer.render(scene, camera);
      };
      render();

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pointermove", onPointer);
        geometry.dispose();
        material.dispose();
        pointsGeometry.dispose();
        (points.material as ThreeTypes.PointsMaterial).dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => undefined);

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={containerRef} aria-hidden className={className} />;
}
