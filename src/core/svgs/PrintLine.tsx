import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const PrintLine = (props: SvgProps) => (
  <Svg width={24} height={24} fill="none" {...props}>
    <Path
      fill="#2D3748"
      d="M6 19H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-3v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2Zm0-2v-1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1h2V9H4v8h2ZM8 4v3h8V4H8Zm0 13v3h8v-3H8Zm-3-7h3v2H5v-2Z"
    />
  </Svg>
);
export default PrintLine;
