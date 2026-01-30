# Minra Mosaique - Demosaicing Algorithms

This document describes the Bayer demosaicing algorithms implemented in Minra Mosaique for Unity and Unreal Engine.

## Bayer CFA Pattern (RGGB)

The Bayer Color Filter Array arranges color filters in a specific pattern:

```
Even rows: R G R G R G R G ...
Odd rows:  G B G B G B G B ...
```

This results in:
- 50% green pixels (matching human visual sensitivity)
- 25% red pixels
- 25% blue pixels

### Position Detection

For a pixel at coordinates (x, y):
- **Red position**: `(y % 2 == 0) && (x % 2 == 0)`
- **Green on Red row**: `(y % 2 == 0) && (x % 2 == 1)`
- **Green on Blue row**: `(y % 2 == 1) && (x % 2 == 0)`
- **Blue position**: `(y % 2 == 1) && (x % 2 == 1)`

## Algorithm 1: Bilinear Interpolation

**Characteristics:**
- Neighborhood: 3x3
- Boundary handling: Clamp-to-edge
- Texture lookups: 2-4 per pixel depending on position
- Quality: Good for most use cases
- Performance: Fast

### Implementation

For each pixel position, the algorithm averages neighboring pixels:

```
At R position (native red):
  R = center pixel
  G = average of 4 cross neighbors (N, S, E, W)
  B = average of 4 diagonal neighbors (NW, NE, SW, SE)

At G position on R row:
  R = average of 2 horizontal neighbors (W, E)
  G = center pixel
  B = average of 2 vertical neighbors (N, S)

At G position on B row:
  R = average of 2 vertical neighbors (N, S)
  G = center pixel
  B = average of 2 horizontal neighbors (W, E)

At B position (native blue):
  R = average of 4 diagonal neighbors
  G = average of 4 cross neighbors
  B = center pixel
```

### Pros & Cons

**Pros:**
- Simple and fast
- Low GPU cost
- Good results for most images

**Cons:**
- Can produce color fringing at high-contrast edges
- Less sharp than advanced algorithms

## Algorithm 2: Malvar-He-Cutler (MHC)

**Characteristics:**
- Neighborhood: 5x5
- Boundary handling: Mirror reflection
- Texture lookups: up to 13 per pixel
- Quality: High with excellent edge preservation
- Performance: Moderate GPU cost

### Implementation

The MHC algorithm uses gradient-corrected interpolation with 5x5 kernels. The key insight is that the green channel can be used to guide the interpolation of red and blue channels, preserving edges better.

#### Kernel Weights

The algorithm uses specific coefficient kernels. For example, to estimate G at an R location:

```
Kernel for G at R:
     0   0  -1   0   0
     0   0   2   0   0
    -1   2   4   2  -1
     0   0   2   0   0
     0   0  -1   0   0

Divisor: 8
```

#### Simplified Formulas

```
At R position:
  R = center
  G = (4*center + 2*(N+S+W+E) - (N2+S2+W2+E2)) / 8
  B = (6*center + 2*(NW+NE+SW+SE) - 1.5*(N2+S2+W2+E2)) / 8

At G on R row:
  R = (5*center + 4*(W+E) - correction) / 8
  G = center
  B = (5*center + 4*(N+S) - correction) / 8

At G on B row:
  R = (5*center + 4*(N+S) - correction) / 8
  G = center
  B = (5*center + 4*(W+E) - correction) / 8

At B position:
  R = (6*center + 2*(NW+NE+SW+SE) - 1.5*(N2+S2+W2+E2)) / 8
  G = (4*center + 2*(N+S+W+E) - (N2+S2+W2+E2)) / 8
  B = center
```

Where N2, S2, W2, E2 are pixels 2 steps away in each direction.

### Pros & Cons

**Pros:**
- Excellent edge preservation
- Reduced color fringing
- Better detail retention

**Cons:**
- Higher GPU cost (larger kernel)
- More texture reads per pixel

## Boundary Handling

### Clamp-to-Edge (Bilinear)

When sampling outside the texture bounds, the nearest edge pixel is used:

```cpp
x = clamp(x, 0, width - 1)
y = clamp(y, 0, height - 1)
```

### Mirror Reflection (MHC)

When sampling outside the texture bounds, coordinates are reflected:

```cpp
if (x < 0) x = -x;
if (y < 0) y = -y;
if (x >= width) x = 2 * width - x - 2;
if (y >= height) y = 2 * height - y - 2;
```

This produces smoother results at image boundaries.

## Performance Comparison

| Algorithm | GPU Cost | Quality | Edge Preservation |
|-----------|----------|---------|-------------------|
| Bilinear | Low | Good | Moderate |
| MHC | Moderate | Excellent | Excellent |

### Recommendations

- **Use Bilinear** for:
  - Real-time applications
  - Large textures where performance matters
  - Images without high-contrast edges

- **Use MHC** for:
  - Final quality renders
  - Images with fine detail
  - Situations where edge quality is critical

## References

1. Malvar, H.S., He, L., Cutler, R. (2004). "High-Quality Linear Interpolation for Demosaicing of Bayer-Patterned Color Images." IEEE ICASSP.

2. Bayer, B.E. (1976). "Color imaging array." U.S. Patent 3,971,065.
