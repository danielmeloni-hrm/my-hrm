'use client'

import { useEffect, useMemo, useState } from 'react'
import Particles from 'react-tsparticles'
import type { ISourceOptions } from 'tsparticles-engine'
import { tsParticles } from 'tsparticles-engine'
import { loadSlim } from 'tsparticles-slim'

export default function ParticlesBackground() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      await loadSlim(tsParticles)
      setReady(true)
    })()
  }, [])

  const options: ISourceOptions = useMemo(
    () => ({
      background: { color: 'transparent' },
      fullScreen: { enable: false },
      fpsLimit: 60,
      detectRetina: true,

      particles: {
        number: { value: 100, density: { enable: true, area: 900 } },
        color: { value: '#ffffff' },
        opacity: { value: 0.6 },
        size: { value: { min: 1, max: 3 } },

        links: {
          enable: true,
          distance: 140,
          color: '#ffffff',
          opacity: 0.12,
          width: 1,
        },

        move: {
          enable: true,
          speed: 0.7,
          outModes: {
            default: 'bounce',
          },
        },
        },

      interactivity: {
        events: {
          onHover: { enable: true, mode: 'repulse' },
          resize: true,
        },
        modes: {
          repulse: { distance: 140, duration: 0.25 },
        },
      },
    }),
    []
  )

  if (!ready) return null

  return (
    <Particles
      id="login-particles"
      options={options}
      className="absolute inset-0"
    />
  )
}