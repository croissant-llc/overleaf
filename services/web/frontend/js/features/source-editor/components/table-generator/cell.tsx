import { FC, MouseEventHandler, useCallback, useEffect, useRef } from 'react'
import { CellData, ColumnDefinition, RowData } from './tabular'
import classNames from 'classnames'
import {
  TableSelection,
  useSelectionContext,
} from './contexts/selection-context'
import { useEditingContext } from './contexts/editing-context'
import { loadMathJax } from '../../../mathjax/load-mathjax'
import { typesetNodeIntoElement } from '../../extensions/visual/utils/typeset-content'
import { parser } from '../../lezer-latex/latex.mjs'

export const Cell: FC<{
  cellData: CellData
  columnSpecification: ColumnDefinition
  rowIndex: number
  columnIndex: number
  row: RowData
}> = ({ cellData, columnSpecification, rowIndex, columnIndex, row }) => {
  const { selection, setSelection } = useSelectionContext()
  const renderDiv = useRef<HTMLDivElement>(null)
  const {
    cellData: editingCellData,
    updateCellData: update,
    startEditing,
  } = useEditingContext()
  const inputRef = useRef<HTMLInputElement>(null)

  const editing =
    editingCellData?.rowIndex === rowIndex &&
    editingCellData?.cellIndex === columnIndex

  const onMouseDown: MouseEventHandler = useCallback(
    event => {
      if (event.button !== 0) {
        return
      }
      event.stopPropagation()
      setSelection(current => {
        if (event.shiftKey && current) {
          return new TableSelection(current.from, {
            row: rowIndex,
            cell: columnIndex,
          })
        } else {
          return new TableSelection(
            { row: rowIndex, cell: columnIndex },
            { row: rowIndex, cell: columnIndex }
          )
        }
      })
    },
    [setSelection, rowIndex, columnIndex]
  )

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  const filterInput = (input: string) => {
    // TODO: Are there situations where we don't want to filter the input?
    return input.replaceAll(/(?<!\\)&/g, '\\&').replaceAll('\\\\', '')
  }

  const hasFocus = selection?.contains({ row: rowIndex, cell: columnIndex })
  useEffect(() => {
    const toDisplay = cellData.content.trim()
    if (renderDiv.current && !editing) {
      const tree = parser.parse(toDisplay)
      const node = tree.topNode

      typesetNodeIntoElement(
        node,
        renderDiv.current,
        toDisplay.substring.bind(toDisplay)
      )
      loadMathJax().then(async MathJax => {
        await MathJax.typesetPromise([renderDiv.current])
      })
    }
  }, [cellData.content, editing])

  let body = <div ref={renderDiv} />
  if (editing) {
    body = (
      <input
        className="table-generator-cell-input"
        ref={inputRef}
        value={editingCellData.content}
        style={{ width: `inherit` }}
        onChange={e => {
          update(filterInput(e.target.value))
        }}
      />
    )
  }

  const onDoubleClick = useCallback(() => {
    startEditing(rowIndex, columnIndex, cellData.content.trim())
  }, [columnIndex, rowIndex, cellData, startEditing])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <td
      onDoubleClick={onDoubleClick}
      tabIndex={row.cells.length * rowIndex + columnIndex + 1}
      onMouseDown={onMouseDown}
      className={classNames('table-generator-cell', {
        'table-generator-cell-border-left': columnSpecification.borderLeft > 0,
        'table-generator-cell-border-right':
          columnSpecification.borderRight > 0,
        'table-generator-row-border-top': row.borderTop > 0,
        'table-generator-row-border-bottom': row.borderBottom > 0,
        'alignment-left': columnSpecification.alignment === 'left',
        'alignment-center': columnSpecification.alignment === 'center',
        'alignment-right': columnSpecification.alignment === 'right',
        'alignment-paragraph': columnSpecification.alignment === 'paragraph',
        focused: hasFocus,
        'selection-edge-top': hasFocus && selection?.bordersTop(rowIndex),
        'selection-edge-bottom': hasFocus && selection?.bordersBottom(rowIndex),
        'selection-edge-left': hasFocus && selection?.bordersLeft(columnIndex),
        'selection-edge-right':
          hasFocus && selection?.bordersRight(columnIndex),
      })}
    >
      {body}
    </td>
  )
}