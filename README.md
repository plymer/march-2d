# March-2D

A TypeScript learning project to help me understand how to bridge the gap between the concept and execution of a geospatial tool.

## The Algorithm

Requirements:

1. 2D grid of values [with dimensions as a power of 2]
2. threshold value

<<< already I can see how this can be a parallelized operation >>>

KEY POINTS:

- we take the marched values (cell indices) and use that as the 'topology': which edges are crossed
- convert the topology in geometry by interpolating a point on EACH EDGE that is crossed using the original field data values (the original scalar values that we thresholded to get the binary grid) to find the exact position of the contour line along the edges of the cell

### Step 1

Apply a threshold to the 2D field to make a binary 'image':
1 where the data is above the threshold value
0 where the data is below the threshold value
-- treat data _at_ the threshold in a consistent above/below way

Every 2x2 block of pixels in the binary image forms a cell used for contouring - this means that the contouring grid is n-1 pixels smaller in each dimension

### Step 2

Compose the 4 bits at the corners of the cells to build a binary index by walking the outside of the cell in a clockwise direction and appending the bit to the index using bitwise OR and left-shift from the most significant bit at the top left and the least significant bit at the bttom left - the resulting 4-bit index has a range of possible values of 0-15 --- THIS IS THE CELL INDEX

### Step 3

Look up the cell indices in a pre-built LUT that maps an index to an edge 'case' (shape) --- CALCULATE TOPOLOGY FROM CELL INDICES

### Step 4

Apply linear interpolation between the original field data values to find the exact position of the contour line along the edges of the cell

### Step 5

Combine line segments from each cell to build the full contour lines.

a. normalize the identities of the segments' endpoints by converting their x,y coordinates into a string key with a defined precision, which allows us to reliably compare points for equality and use them as keys in our adjacency map

b. map endpoints to adjacency - this creates an 'identity' of which segments are connected to which other segments by virtue of sharing an endpoint

    You convert a flat list of segments into a lookup table:

    1. Key: a point (endpoint) identity, like x,y.
    2. Value: all segment indices that touch that point.

    So instead of scanning every segment each time, you can instantly ask:
    which segments connect to this endpoint?

    Polyline construction is graph traversal.

    1. Endpoints are graph nodes.
    2. Segments are graph edges.
    3. Adjacency map is the node-to-edge index.

    Without this map, joining segments is slow and messy. With it, walking a contour is straightforward.

c. walk the segments to build polylines

    start by walking all length === 1 nodes: loop over all entries in the adjacency map and start walking from any point that has only one connected segment, which means it's a dead end and therefore the start of a new polyline - this handles all open contours that have endpoints

    after walking all of the open contours, we may have some closed loops left that were not walked because they have no endpoints - we can start walking from any segment in the loop and we will eventually return to the starting point, which will complete the loop and add it as a polyline
