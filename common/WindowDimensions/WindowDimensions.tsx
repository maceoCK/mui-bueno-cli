import React from 'react';

interface WindowDimensions {
    height: number;
    width: number;
}

/**
 *
 * @returns The dimensions of the window (height and width in pixels)
 */
const getWindowDimensions = (): WindowDimensions => {
    return {
        height: window.innerHeight,
        width: window.innerWidth,
    };
};

/**
 * Gets the dimensions of the window (height and width in pixels)
 * and updates the values on window resize.
 *
 * Some Mui Bueno components rely on the screen size to establish styling based on breakpoints.
 * This function can be used to get the window width, without having to set a window context
 * in the BForm component, as originally was occurring. Thus, components do not have to be nested
 * in a BForm component in order to be styled properly.
 *
 * This function will not be exported from the library.
 *
 * **Example Usage**
 * ```tsx
 * const { width } = useWindowDimensions();
 * // or
 * const { width, height } = useWindowDimensions();
 * ```
 *
 * @returns Window dimensions
 */
export const useWindowDimensions = () => {
    const [windowDimensions, setWindowDimensions] = React.useState<WindowDimensions>(getWindowDimensions());

    React.useEffect(() => {
        const handleResize = () => {
            setWindowDimensions(getWindowDimensions());
        };

        // listen for window resize, calls handleResize
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return windowDimensions;
};
