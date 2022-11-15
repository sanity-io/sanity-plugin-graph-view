import styled from 'styled-components'
import {Theme} from '@sanity/ui'
import {black} from '@sanity/color'
import React, {PropsWithChildren} from 'react'

type Style = PropsWithChildren<{theme: SanityTheme}>
type SanityTheme = Theme['sanity']

export const GraphRoot: React.FC<Style> = styled.div`
  font-family: ${({theme}: Style) => theme.fonts.text.family};
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: ${black.hex};
`

export const GraphWrapper: React.FC<Style> = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
` as React.FC<Style>

export const HoverNode: React.FC<Style> = styled.div`
  font-family: ${({theme}: Style) => theme.fonts.text.family};
  display: none;
  position: absolute;
  bottom: ${({theme}: Style) => theme.space[0]}px;
  left: 50%;
  transform: translate3d(-50%, 0, 0);
  background: var(--component-bg);
  border-radius: ${({theme}: Style) => theme.radius[2]}px;
  padding: ${({theme}: Style) => theme.space[2]}px;
  z-index: 1000;

  &:empty {
    display: none;
  }
`

export const Legend: React.FC<Style> = styled.div`
  color: #ccc;
  position: absolute;
  top: ${({theme}: Style) => theme.space[4]}px;
  left: ${({theme}: Style) => theme.space[4]}px;

  & > div {
    margin: 5px 0;
  }
`

export const LegendRow = styled.div`
  display: flex;
`

export const LegendBadge: React.FC<Style> = styled.div`
  width: 1.25em;
  height: 1.25em;
  background: currentColor;
  border-radius: 50%;
  margin-right: ${({theme}: Style) => theme.space[2]}px;
`
