"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function Hero3DCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || window.innerWidth || 800;
    const height = mount.clientHeight || window.innerHeight || 600;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch (e) {
      console.warn("WebGL not supported or failed to initialize:", e);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / Math.max(height, 1), 0.1, 1000);
    camera.position.z = 18;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    mount.appendChild(renderer.domElement);

    // Geometrical Central Polyhedron (Icosahedron)
    const geometry = new THREE.IcosahedronGeometry(6, 1);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const sphereMesh = new THREE.Mesh(geometry, wireframeMaterial);
    scene.add(sphereMesh);

    // Inner Glowing Core Polyhedron
    const innerGeo = new THREE.IcosahedronGeometry(4.2, 0);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMaterial);
    scene.add(innerMesh);

    // Surrounding Floating Particles Constellation
    const particleCount = 100;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 26;
      particlePositions[i + 1] = (Math.random() - 0.5) * 26;
      particlePositions[i + 2] = (Math.random() - 0.5) * 26;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.12,
      transparent: true,
      opacity: 0.7,
    });
    const particleMesh = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleMesh);

    let isContextLost = false;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      cancelAnimationFrame(animationFrameId);
    };
    const handleContextRestored = () => {
      isContextLost = false;
      animate();
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);
    renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored, false);

    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(mount);

    // Mouse Tracking for Smooth Parallax (Throttled)
    let targetX = 0;
    let targetY = 0;
    let mouseTimeout: any = null;
    const handleMouseMove = (event: MouseEvent) => {
      if (!isVisible || isContextLost) return;
      if (mouseTimeout) return;
      mouseTimeout = setTimeout(() => {
        mouseTimeout = null;
      }, 30);
      const { innerWidth, innerHeight } = window;
      targetX = (event.clientX / (innerWidth || 1) - 0.5) * 0.4;
      targetY = (event.clientY / (innerHeight || 1) - 0.5) * 0.4;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible || isContextLost) return; // Pause rendering loop when out of viewport or context lost

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Smooth slow auto-rotation calibrated to delta
      sphereMesh.rotation.x += 0.12 * delta;
      sphereMesh.rotation.y += 0.18 * delta;

      innerMesh.rotation.x -= 0.18 * delta;
      innerMesh.rotation.y -= 0.24 * delta;

      particleMesh.rotation.y += 0.05 * delta;

      // Parallax damping
      camera.position.x += (targetX * 5 - camera.position.x) * 0.04;
      camera.position.y += (-targetY * 5 - camera.position.y) * 0.04;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };
    animate();

    // Throttled Resize Handler
    let resizeTimer: any = null;
    const handleResize = () => {
      if (!mount || isContextLost) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }, 150);
    };
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (mouseTimeout) clearTimeout(mouseTimeout);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      geometry.dispose();
      innerGeo.dispose();
      wireframeMaterial.dispose();
      innerMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden opacity-85"
      style={{ contain: "strict" }}
    />
  );
}
