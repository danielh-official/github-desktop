import * as React from 'react'
import classNames from 'classnames'
import {
  Popover,
  PopoverAnchorPosition,
  PopoverDecoration,
} from '../lib/popover'
import { Button } from '../lib/button'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import {
  IRepositoryListFilterState,
  NoRepositoryListFilters,
} from '../../lib/app-state'
import { hasActiveRepositoryFilters } from './group-repositories'

interface IRepositoriesListFilterOptionsProps {
  readonly repositoryListFilter: IRepositoryListFilterState

  /** Number of repositories with uncommitted changes */
  readonly uncommittedCount: number

  /** Number of repositories with commits that haven't been pushed */
  readonly unpushedCount: number

  readonly onFilterChanged: (filter: IRepositoryListFilterState) => void
}

interface IRepositoriesListFilterOptionsState {
  readonly isFilterOptionsOpen: boolean
}

/**
 * Component to render the filter options for the repository list, letting the
 * user narrow the list down to repositories with local changes.
 */
export class RepositoriesListFilterOptions extends React.Component<
  IRepositoriesListFilterOptionsProps,
  IRepositoriesListFilterOptionsState
> {
  private filterOptionsButtonRef: HTMLButtonElement | null = null

  public constructor(props: IRepositoriesListFilterOptionsProps) {
    super(props)

    this.state = { isFilterOptionsOpen: false }
  }

  private closeFilterOptions = () => {
    this.setState({ isFilterOptionsOpen: false })
  }

  private toggleFilterOptionsOpen = () => {
    this.setState(prevState => ({
      isFilterOptionsOpen: !prevState.isFilterOptionsOpen,
    }))
  }

  private onFilterUncommittedChanges = () => {
    const { repositoryListFilter: filter } = this.props
    this.props.onFilterChanged({
      ...filter,
      hasUncommittedChanges: !filter.hasUncommittedChanges,
    })
  }

  private onFilterUnpushedCommits = () => {
    const { repositoryListFilter: filter } = this.props
    this.props.onFilterChanged({
      ...filter,
      hasUnpushedCommits: !filter.hasUnpushedCommits,
    })
  }

  private onClearAllFilters = () => {
    this.props.onFilterChanged(NoRepositoryListFilters)
    this.closeFilterOptions()
  }

  private onFilterOptionsButtonRef = (buttonRef: HTMLButtonElement | null) => {
    this.filterOptionsButtonRef = buttonRef
  }

  private renderFilterOptions() {
    const {
      repositoryListFilter: filter,
      uncommittedCount,
      unpushedCount,
    } = this.props

    return (
      <Popover
        className="filter-popover"
        ariaLabelledby="repository-filter-options-header"
        anchor={this.filterOptionsButtonRef}
        anchorPosition={PopoverAnchorPosition.BottomLeft}
        decoration={PopoverDecoration.Balloon}
        onMousedownOutside={this.closeFilterOptions}
        onClickOutside={this.closeFilterOptions}
      >
        <div className="filter-popover-header">
          <h3 id="repository-filter-options-header">Filter Options</h3>
          <button
            className="close"
            onClick={this.closeFilterOptions}
            aria-label="Close"
          >
            <Octicon symbol={octicons.x} />
          </button>
        </div>
        <div className="filter-options">
          <Checkbox
            value={
              filter.hasUncommittedChanges
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onFilterUncommittedChanges}
            label={`Uncommitted changes (${uncommittedCount})`}
          />
          <Checkbox
            value={
              filter.hasUnpushedCommits ? CheckboxValue.On : CheckboxValue.Off
            }
            onChange={this.onFilterUnpushedCommits}
            label={`Unpushed commits (${unpushedCount})`}
          />
        </div>
        {hasActiveRepositoryFilters(filter) && (
          <div className="filter-options-footer">
            <Button onClick={this.onClearAllFilters}>Clear filters</Button>
          </div>
        )}
      </Popover>
    )
  }

  public render() {
    const filtersActive = hasActiveRepositoryFilters(
      this.props.repositoryListFilter
    )
    const buttonTextLabel = `Filter Options ${
      filtersActive ? '(filters applied)' : ''
    }`

    return (
      <>
        <Button
          className={classNames('filter-button', { active: filtersActive })}
          onClick={this.toggleFilterOptionsOpen}
          ariaExpanded={this.state.isFilterOptionsOpen}
          onButtonRef={this.onFilterOptionsButtonRef}
          tooltip={buttonTextLabel}
          ariaLabel={buttonTextLabel}
        >
          <span>
            <Octicon symbol={octicons.filter} />
          </span>
          {filtersActive ? (
            <span className="active-badge">
              <div className="badge-bg">
                <div className="badge"></div>
              </div>
            </span>
          ) : null}
          <Octicon symbol={octicons.triangleDown} />
        </Button>
        {this.state.isFilterOptionsOpen && this.renderFilterOptions()}
      </>
    )
  }
}
