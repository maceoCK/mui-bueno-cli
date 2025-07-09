import { MenuOption } from '../../@types';
import { SelectOption } from '../../components/Form/Inputs/Select/Select';
import { Link as RouterLink } from 'react-router-dom';

const layoutProps: string[] = [
    'w',
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
    'alignment',
    'justify',
    'noMP',
    'noGrid',
    'gridClassName',
    'gridStyle',
];
//Forcefully formats strings and manually places cursor in correct position

export const isNumber = (char: number): boolean => {
    // valid when '0' <= char <= '9'
    return char > 47 && char < 58;
};

export const isLetter = (char: number): boolean => {
    // valid when 'A' <= char <= 'z', char <= 'Z' || char >= 'a'
    return char > 64 && char < 123 && (char < 91 || char > 96);
};

export const autoformat = (input: string, format: string, currValue: string, element: HTMLInputElement): string => {
    let strippedString = ''; //Input string which has been stripped of formatting
    let formatIndex = 0;
    let copyPasteFormat = 0; //For when input that is copypasted is not formatted (counts the number of non-formatted characters in format string)
    let counter = 0; //counter for the advanceCursor.
    let advanceCursor = 0; //In the case that the last character is after several unformatted characters, counts the number of unformatted characters directly preceeding the last character
    const cursorStart = element.selectionStart as number; //Initial cursor position
    let preventWrongInputMovingForward = false; //When the input is less than the length of the format and the change in the input does not match the format, we want to prevent the cursor from moving forward
    if (input.length <= format.length) {
        for (let inputIndex = 0; inputIndex < input.length && inputIndex < format.length; inputIndex++) {
            while (formatIndex < format.length && format[formatIndex] !== 'X' && format[formatIndex] !== '9') {
                //Neither a letter nor a number in the format string
                counter++;
                copyPasteFormat++;
                formatIndex++;
            }
            if (
                (isNumber(input.charCodeAt(inputIndex)) && format[formatIndex] === '9') ||
                (isLetter(input.charCodeAt(inputIndex)) && format[formatIndex] === 'X')
            ) {
                //If it matches the format string
                if (counter > 0) {
                    //if there were any unformatted characters before this character
                    advanceCursor = counter; //Notes down how many unformatted characters before the current character
                    counter = 0; //Resets to 0 to ignore the unformatted characters that appear earlier in the string - only focus on those immediately preceeding the last character
                }
                strippedString += input[inputIndex];
                formatIndex++;
            } // else skips that index in input
        }
        const inputType = isNumber(input.charCodeAt(cursorStart - 1))
            ? 'number'
            : isLetter(input.charCodeAt(cursorStart - 1))
              ? 'letter'
              : 'something else';

        const inputTypeNotNumberFStringIs = inputType !== 'number' && format[cursorStart - 1] === '9';
        const inputTypeNotLetterFStringIs = inputType !== 'letter' && format[cursorStart - 1] === 'X';
        const somethingElse = inputType === 'something else';

        if (inputTypeNotNumberFStringIs || inputTypeNotLetterFStringIs || somethingElse) {
            preventWrongInputMovingForward = true;
        }

        let formattedString = '';
        let fmtIdx = 0; // formatIndex of this function
        if (Math.abs(currValue.length - input.length) <= 1) {
            copyPasteFormat = 0;
        }
        let caret = cursorStart + copyPasteFormat;
        for (let valIndex = 0; valIndex < strippedString.length; valIndex++) {
            while (fmtIdx < format.length && format[fmtIdx] !== 'X' && format[fmtIdx] !== '9') {
                // skips to next formatted char that is a letter or number
                formattedString += format[fmtIdx];
                fmtIdx++;
            }
            formattedString += strippedString[valIndex];
            fmtIdx++;
        }
        if (input.length < currValue.length) {
            window.requestAnimationFrame(() => {
                element.selectionStart = caret;
                element.selectionEnd = caret;
            });
        } else if (format[caret - 1] !== 'X' && format[caret - 1] !== '9') {
            window.requestAnimationFrame(() => {
                element.selectionStart = caret + advanceCursor;
                element.selectionEnd = caret + advanceCursor;
            });
        } else {
            if (preventWrongInputMovingForward) {
                caret -= 1;
            }
            window.requestAnimationFrame(() => {
                element.selectionStart = caret;
                element.selectionEnd = caret;
            });
        }

        // trailing formatted chars
        const trail = format.slice(fmtIdx);
        if (trail.indexOf('X') === -1 && trail.indexOf('9') === -1) {
            formattedString += trail;
        }

        // set the displayed value as the formatted string
        return formattedString;
    }
    window.requestAnimationFrame(() => {
        element.selectionStart = cursorStart - 1;
        element.selectionEnd = cursorStart - 1;
    });
    return currValue;
};

export const isFormatted = (item?: string, format?: string): boolean => {
    if (!item || !format) {
        return true;
    }

    if (format.length === 0) {
        return true;
    }
    if (item.length !== format.length) {
        return false;
    }
    for (let i = 0; i < item.length; i++) {
        const c = item.charCodeAt(i);
        if (format[i] === 'X') {
            if (!isLetter(c)) {
                return false;
            }
        } else if (format[i] === '9') {
            if (!isNumber(c)) {
                return false;
            }
        } else if (c !== format.charCodeAt(i)) {
            return false;
        }
    }
    return true;
};

/**
 * Helper function to remove unwanted prop fields from the provided props object
 *
 * @param props Props
 * @param omit List of keys to omit from props
 * @returns Clean props object
 */
export function removeStrayProps(props: Record<string, unknown>, omit: readonly string[]): object {
    //No easy way to check if the keys of the object are from a typescript type
    /** All keys from the provided props */
    const keys: string[] = Object.keys(props);

    /** Prop keys to omit in return */
    const keysToOmit: string[] = keys.filter((el) => omit.includes(el));

    const o = { ...props };

    // remove layout props
    for (const prop of layoutProps) {
        delete o[prop];
    }
    // remove keys to omit
    for (const key of keysToOmit) {
        delete o[key];
    }
    return o;
}

/**
 * Converts string to label (ex. "this.isMy-string" --> "This Is My String")
 */
export const makeLabel = (s: string): string => {
    const splitByCamelAndSpecialChars = s
        .split(/(?=[A-Z])|[.\-_\s]+/) // split by camelCase OR specific special characters (., -, _)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) //capitalize first letter only
        .filter(Boolean); // filter out empty strings

    return splitByCamelAndSpecialChars.join(' ');
};

/**
 * Finds value/values in option list, and returns correct label string.
 * If there are multiples values, the labels will be listed based on their order
 * in the options list
 * @param options Options
 * @param value string
 * @param multiple specifies if the value string will contain more than one value to
 * @param placeholder placeholder to display in a field if the value is null
 * @returns string representation of value
 */
export function renderValue<T>(options: SelectOption<T>[], value?: string, multiple = false, placeholder = '') {
    let strDisplay = '';
    if (value == undefined || value.length == 0) {
        return placeholder;
    } else if (!multiple) {
        // return single label
        const selected = options.find((o) => value == (o.value as unknown as string));
        if (selected != undefined) {
            strDisplay = selected.label;
        }
    } else {
        // build comma delineated string of labels ordered by their index in options
        let selected = '';
        const list = value.toString().split(',');
        let count = 0;
        options.forEach((o) => {
            if (list.includes(String(o.value).toString())) {
                selected += o.label;
                if (count < list.length - 1) {
                    selected += ', ';
                }
                count++;
            }
        });
        strDisplay = selected;
    }
    return strDisplay;
}

/**
 * Generates the proper parameters for a MenuOption. For each `MenuOption`, if `path` is defined, but
 * NOT `onClick`, it will behave as a link. Otherwise, it will behave as a button. In other words:
 *   path only --> link
 *   onClick only --> button
 *   path & onClick --> button (onClick will be executed before navigating to path)
 *
 * @param menuOption -- menuOption to generate the button/link props for
 * @param naviate -- pass useNavigate's navigate fn. used when onClick & path are both present to navigate to the path
 * @param onClickCallback -- (optional) called at the end of the onClick in case any additional execution is needed (ex. closing a modal)
 */
export function generateButtonLinkProps(
    menuOption: MenuOption,
    navigate: (path: string) => void,
    onClickCallback?: () => void
) {
    if (menuOption.onClick) {
        return {
            onClick: () => {
                menuOption.onClick!();
                if (menuOption.path) navigate(menuOption.path);
                if (menuOption.externalLink) window.open(menuOption.externalLink, '_blank', 'noopener');
                if (onClickCallback) onClickCallback();
            },
        };
    } else if (menuOption.path) {
        return {
            component: RouterLink,
            to: menuOption.path,
        };
    } else if (menuOption.externalLink) {
        return {
            href: menuOption.externalLink,
        };
    } else {
        return {};
    }
}

/**
 * Opens the specified URL in a new tab
 */
export const launchTab = (url: string) => window.open(url, '_blank', 'noopener');
