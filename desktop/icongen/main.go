// Draws the app icon: the outlined greatsword on white.
// Usage: icongen out.png [size]   (default 256px)
package main

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"os"
)

type pt struct{ x, y float64 }

func inPoly(p pt, poly []pt) bool {
	in := false
	for i, j := 0, len(poly)-1; i < len(poly); j, i = i, i+1 {
		a, b := poly[i], poly[j]
		if (a.y > p.y) != (b.y > p.y) && p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x {
			in = !in
		}
	}
	return in
}

func main() {
	n := 256
	if len(os.Args) > 2 {
		fmt.Sscan(os.Args[2], &n)
	}
	// sword along the diagonal, point up-right, in unit space
	ang := -math.Pi / 4
	dx, dy := math.Cos(ang), math.Sin(ang)
	nx, ny := -dy, dx
	at := func(along, across float64) pt {
		cx, cy := 0.5-dx*0.06, 0.5-dy*0.06
		return pt{cx + dx*along + nx*across, cy + dy*along + ny*across}
	}
	blade := []pt{at(-0.16, 0.055), at(0.3, 0.05), at(0.44, 0), at(0.3, -0.03), at(-0.16, -0.055)}
	guard := []pt{at(-0.19, 0.16), at(-0.15, 0.16), at(-0.15, -0.16), at(-0.19, -0.16)}
	grip := []pt{at(-0.33, 0.025), at(-0.18, 0.025), at(-0.18, -0.025), at(-0.33, -0.025)}
	pommel := at(-0.36, 0)

	sword := func(p pt) bool {
		return inPoly(p, blade) || inPoly(p, guard) || inPoly(p, grip) ||
			math.Hypot(p.x-pommel.x, p.y-pommel.y) < 0.035
	}
	// outline: inside the sword but within `t` of its edge
	const t = 0.016
	outline := func(p pt) bool {
		if !sword(p) {
			return false
		}
		for k := 0; k < 8; k++ {
			a := float64(k) * math.Pi / 4
			if !sword(pt{p.x + math.Cos(a)*t, p.y + math.Sin(a)*t}) {
				return true
			}
		}
		return false
	}

	img := image.NewNRGBA(image.Rect(0, 0, n, n))
	const ss = 4
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			black, inside := 0, 0
			for sy := 0; sy < ss; sy++ {
				for sx := 0; sx < ss; sx++ {
					p := pt{(float64(x) + (float64(sx)+0.5)/ss) / float64(n), (float64(y) + (float64(sy)+0.5)/ss) / float64(n)}
					// rounded white tile with a black rim
					qx, qy := math.Max(math.Abs(p.x-0.5)-0.36, 0), math.Max(math.Abs(p.y-0.5)-0.36, 0)
					d := math.Hypot(qx, qy)
					if d > 0.12 {
						continue
					}
					inside++
					if d > 0.095 || outline(p) {
						black++
					}
				}
			}
			if inside == 0 {
				continue
			}
			v := uint8(255 - 255*black/inside)
			img.Set(x, y, color.NRGBA{v, v, v, uint8(255 * inside / (ss * ss))})
		}
	}
	f, err := os.Create(os.Args[1])
	if err != nil {
		panic(err)
	}
	defer f.Close()
	png.Encode(f, img)
}
