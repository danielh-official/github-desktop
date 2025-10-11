import * as React from 'react'
import * as Path from 'path'
import { Dispatcher } from '../dispatcher'
import { addSafeDirectory, getRepositoryType } from '../../lib/git'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { Row } from '../lib/row'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { PopupType } from '../../models/popup'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { FoldoutType } from '../../lib/app-state'

import untildify from 'untildify'
import { showOpenDialog } from '../main-process-proxy'
import { Ref } from '../lib/ref'
import { InputError } from '../lib/input-description/input-error'
import { IAccessibleMessage } from '../../models/accessible-message'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { searchForRepository } from '../../lib/query'

interface IAddExistingRepositoryProps {
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void

  /** An optional path to prefill the path text box with.
   * Defaults to the empty string if not defined.
   */
  readonly path?: string
}

interface IAddExistingRepositoryState {
  readonly path: string
  readonly useQueryForPathInstead: boolean
  readonly queryForPath: string
  readonly parentDirectoryPath: string

  /**
   * Indicates whether or not to render a warning message about the entered path
   * not containing a valid Git repository. This value differs from `isGitRepository` in that it holds
   * its value when the path changes until we've gotten a definitive answer from the asynchronous
   * method that the path is, or isn't, a valid repository path. Separating the two means that
   * we don't toggle visibility of the warning message until it's really necessary, preventing
   * flickering for our users as they type in a path.
   */
  readonly showNonGitRepositoryWarning: boolean
  readonly isRepositoryBare: boolean
  readonly isRepositoryUnsafe: boolean
  readonly repositoryUnsafePath?: string
  readonly isTrustingRepository: boolean
}

/** The component for adding an existing local repository. */
export class AddExistingRepository extends React.Component<
  IAddExistingRepositoryProps,
  IAddExistingRepositoryState
> {
  private pathTextBoxRef = React.createRef<TextBox>()

  private queryForPathTextBoxRef = React.createRef<TextBox>()

  private parentDirectoryPathTextBoxRef = React.createRef<TextBox>()

  public constructor(props: IAddExistingRepositoryProps) {
    super(props)

    const path = this.props.path ? this.props.path : ''

    this.state = {
      path,
      showNonGitRepositoryWarning: false,
      isRepositoryBare: false,
      isRepositoryUnsafe: false,
      isTrustingRepository: false,
      useQueryForPathInstead: false,
      parentDirectoryPath: '',
      queryForPath: '',
    }
  }

  private onTrustDirectory = async () => {
    this.setState({ isTrustingRepository: true })
    const { repositoryUnsafePath, path } = this.state
    if (repositoryUnsafePath) {
      await addSafeDirectory(repositoryUnsafePath)
    }
    await this.validatePath(path)
    this.setState({ isTrustingRepository: false })
  }

  private async updatePath(path: string) {
    this.setState({ path })
  }

  private async validatePath(path: string): Promise<boolean> {
    if (path.length === 0) {
      this.setState({
        isRepositoryBare: false,
        showNonGitRepositoryWarning: false,
      })
      return false
    }

    const type = await getRepositoryType(path)

    const isRepository = type.kind !== 'missing' && type.kind !== 'unsafe'
    const isRepositoryUnsafe = type.kind === 'unsafe'
    const isRepositoryBare = type.kind === 'bare'
    const showNonGitRepositoryWarning = !isRepository || isRepositoryBare
    const repositoryUnsafePath = type.kind === 'unsafe' ? type.path : undefined

    this.setState(state =>
      path === state.path
        ? {
          isRepositoryBare,
          isRepositoryUnsafe,
          showNonGitRepositoryWarning,
          repositoryUnsafePath,
        }
        : null
    )

    return path.length > 0 && isRepository && !isRepositoryBare
  }

  private buildBareRepositoryError() {
    if (
      !this.state.path.length ||
      !this.state.showNonGitRepositoryWarning ||
      !this.state.isRepositoryBare
    ) {
      return null
    }

    const msg =
      'This directory appears to be a bare repository. Bare repositories are not currently supported.'

    return { screenReaderMessage: msg, displayedMessage: msg }
  }

  private buildRepositoryUnsafeError() {
    const { repositoryUnsafePath, path } = this.state
    if (
      !this.state.path.length ||
      !this.state.showNonGitRepositoryWarning ||
      !this.state.isRepositoryUnsafe ||
      repositoryUnsafePath === undefined
    ) {
      return null
    }

    // Git for Windows will replace backslashes with slashes in the error
    // message so we'll do the same to not show "the repo at path c:/repo"
    // when the entered path is `c:\repo`.
    const convertedPath = __WIN32__ ? path.replaceAll('\\', '/') : path

    const displayedMessage = (
      <>
        <p>
          The Git repository
          {repositoryUnsafePath !== convertedPath && (
            <>
              {' at '}
              <Ref>{repositoryUnsafePath}</Ref>
            </>
          )}{' '}
          appears to be owned by another user on your machine. Adding untrusted
          repositories may automatically execute files in the repository.
        </p>
        <p>
          If you trust the owner of the directory you can
          <LinkButton onClick={this.onTrustDirectory}>
            {' '}
            add an exception for this directory
          </LinkButton>{' '}
          in order to continue.
        </p>
      </>
    )

    const screenReaderMessage = `The Git repository appears to be owned by another user on your machine.
      Adding untrusted repositories may automatically execute files in the repository.
      If you trust the owner of the directory you can add an exception for this directory in order to continue.`

    return { screenReaderMessage, displayedMessage }
  }

  private buildNotAGitRepositoryError(): IAccessibleMessage | null {
    if (!this.state.path.length || !this.state.showNonGitRepositoryWarning) {
      return null
    }

    const displayedMessage = (
      <>
        <p>This directory does not appear to be a Git repository.</p>
        <p>
          Would you like to{' '}
          <LinkButton onClick={this.onCreateRepositoryClicked}>
            create a repository
          </LinkButton>{' '}
          here instead?
        </p>
      </>
    )

    const screenReaderMessage =
      'This directory does not appear to be a Git repository. Would you like to create a repository here instead?'

    return { screenReaderMessage, displayedMessage }
  }

  private renderErrors() {
    const msg: IAccessibleMessage | null =
      this.buildBareRepositoryError() ??
      this.buildRepositoryUnsafeError() ??
      this.buildNotAGitRepositoryError()

    if (msg === null) {
      return null
    }

    return (
      <Row>
        <InputError
          id="add-existing-repository-path-error"
          ariaLiveMessage={msg.screenReaderMessage}
        >
          {msg.displayedMessage}
        </InputError>
      </Row>
    )
  }

  public render() {
    return (
      <Dialog
        id="add-existing-repository"
        title={__DARWIN__ ? 'Add Local Repository' : 'Add local repository'}
        onSubmit={this.addRepository}
        onDismissed={this.props.onDismissed}
        loading={this.state.isTrustingRepository}
      >
        <DialogContent>
          <Row>
            <TextBox
              ref={this.pathTextBoxRef}
              value={this.state.path}
              label={__DARWIN__ ? 'Local Path' : 'Local path'}
              placeholder="repository path"
              onValueChanged={this.onPathChanged}
              ariaDescribedBy="add-existing-repository-path-error"
              disabled={this.state.useQueryForPathInstead}
              readOnly={this.state.useQueryForPathInstead}
            />
            <Button onClick={this.showFilePicker} disabled={this.state.useQueryForPathInstead}>Choose…</Button>
          </Row>
          <Row>
            <Checkbox
              label="Use Query For Path"
              value={this.state.useQueryForPathInstead ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onUseQueryForPathInsteadChanged}
            />
          </Row>
          {(this.state.useQueryForPathInstead) && (
            <>
              <Row>
                <TextBox
                  ref={this.parentDirectoryPathTextBoxRef}
                  value={this.state.parentDirectoryPath}
                  label={__DARWIN__ ? 'Parent Directory Path' : 'Parent directory path'}
                  placeholder="parent directory path"
                  onValueChanged={this.onParentDirectoryPathChanged}
                  ariaDescribedBy="add-parent-directory-path-error"
                />
                <Button onClick={this.showParentDirectoryFilePicker}>Choose…</Button>
              </Row>
              <Row>
                <TextBox
                  ref={this.queryForPathTextBoxRef}
                  value={this.state.queryForPath}
                  label={__DARWIN__ ? 'Query For Path' : 'Query for path'}
                  placeholder="query for repository path"
                  onValueChanged={this.onQueryForPathChanged}
                  ariaDescribedBy="add-existing-query-for-repository-path-error"
                />
              </Row>
            </>
          )}
          {this.renderErrors()}
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={__DARWIN__ ? 'Add Repository' : 'Add repository'}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onPathChanged = async (path: string) => {
    if (this.state.path !== path) {
      this.updatePath(path)
    }
  }

  private onUseQueryForPathInsteadChanged = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked ? CheckboxValue.On : CheckboxValue.Off

    this.setState({ useQueryForPathInstead: value === CheckboxValue.On })
  }

  private onParentDirectoryPathChanged = async (parentDirectoryPath: string) => {
    if (this.state.parentDirectoryPath !== parentDirectoryPath) {
      this.setState({ parentDirectoryPath })
    }
  }

  private onQueryForPathChanged = async (queryForPath: string) => {
    if (this.state.queryForPath !== queryForPath) {
      this.setState({ queryForPath })
    }
  }

  private showFilePicker = async () => {
    const path = await showOpenDialog({
      properties: ['createDirectory', 'openDirectory'],
    })

    if (path === null) {
      return
    }

    this.updatePath(path)
  }

  private showParentDirectoryFilePicker = async () => {
    const path = await showOpenDialog({
      properties: ['createDirectory', 'openDirectory'],
    })

    if (path === null) {
      return
    }

    this.setState({ parentDirectoryPath: path })
  }

  private resolvedPath(path: string): string {
    return Path.resolve('/', untildify(path))
  }

  private addRepository = async () => {
    const { path, parentDirectoryPath, queryForPath } = this.state

    if (this.state.useQueryForPathInstead) {
      const parentDirectoryPathIsValid = parentDirectoryPath.length > 0
      const queryForPathIsValid = queryForPath.length > 0

      if (!parentDirectoryPathIsValid) {
        this.parentDirectoryPathTextBoxRef.current?.focus()
        return
      }

      if (!queryForPathIsValid) {
        this.queryForPathTextBoxRef.current?.focus()
        return
      }

      this.props.onDismissed()

      // After validating the parent directory path and query for path, we should use the queryForPath to search for the directory under the parent folder. For now, assume the query is written in regex format and search for the first match.
      const resolvedParentDirectoryPath = this.resolvedPath(parentDirectoryPath)

      // Get a list of all pathnames in the parent directory
      const pathModule = window.require('path')
      let directories: string[] = []

      try {
        directories = await searchForRepository(
          parentDirectoryPath,
          queryForPath
        )
      } catch (error) {
        console.error('Error reading parent directory:', error)
        return
      }

      if (directories.length === 0) {
        // No directories matched the query
        this.queryForPathTextBoxRef.current?.focus()
        console.info('No directories matched the query')
        return
      }

      const fullPath = pathModule.join(resolvedParentDirectoryPath, directories[0])

      const resolvedFullPath = this.resolvedPath(fullPath)
      const repositories = await this.props.dispatcher.addRepositories([resolvedFullPath], {
        useQueryForPathInstead: true,
        parentDirectoryPath: resolvedParentDirectoryPath,
        queryForPath: queryForPath,
      })

      if (repositories.length > 0) {
        this.props.dispatcher.closeFoldout(FoldoutType.Repository)
        this.props.dispatcher.selectRepository(repositories[0])
        this.props.dispatcher.recordAddExistingRepository()
      }
    } else {
      const isValidPath = await this.validatePath(path)

      if (!isValidPath) {
        this.pathTextBoxRef.current?.focus()
        return
      }

      this.props.onDismissed()
      const { dispatcher } = this.props

      const resolvedPath = this.resolvedPath(path)
      const repositories = await dispatcher.addRepositories([resolvedPath])

      if (repositories.length > 0) {
        dispatcher.closeFoldout(FoldoutType.Repository)
        dispatcher.selectRepository(repositories[0])
        dispatcher.recordAddExistingRepository()
      }
    }
  }

  private onCreateRepositoryClicked = () => {
    this.props.onDismissed()

    const resolvedPath = this.resolvedPath(this.state.path)

    return this.props.dispatcher.showPopup({
      type: PopupType.CreateRepository,
      path: resolvedPath,
    })
  }
}
