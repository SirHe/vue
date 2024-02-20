export const isTagStartChar = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
export const isWhitespace = (c) =>
    c === ' ' ||
    c === '\n' ||
    c === '\t' ||
    c === '\f' ||
    c === '\r'
export const isEndOfTagSection = (c) => c === '/' || c === '>' || isWhitespace(c)