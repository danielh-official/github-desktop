import { stat } from 'fs/promises'
import { existsSync, readdirSync, Stats } from 'fs'
import untildify from 'untildify'
import * as Path from 'path'

// TODO: We shouldn't just search the immediate directories under the parent directory but also all nested directories
// It should be a recursive search that stops the moment a directory that matches the query criteria is found
// This is important because users might have their repositories organized in subfolders within the parent directory

/**
 * Search for a repository within a specified parent directory that matches the given query for path.
 *
 * @param parentDirectoryPath - The path to the parent directory where the search should begin.
 * @param queryForPath - The specific directory name to search for within the parent directory.
 * @returns A promise that resolves to an array of matching directory paths.
 */
export async function searchForRepository(
  parentDirectoryPath: string,
  queryForPath: string
): Promise<string[]> {
  const resolvedParentDirectoryPath = Path.resolve(
    '/',
    untildify(parentDirectoryPath)
  )

  const directories: string[] = []

  const files = getDirectoriesRecursive(resolvedParentDirectoryPath)

  for (const file of files) {
    if (file === '.DS_Store' || file === '.git') {
      continue
    }

    let fileStats: Stats

    try {
      fileStats = await stat(file)
    } catch (error) {
      console.log(`Full path trying to find: ${file}`)
      continue
    }

    if (
      fileStats.isDirectory() &&
      file.includes(queryForPath) &&
      existsSync(file + '/.git')
    ) {
      directories.push(file)
      break
    }
  }

  return directories
}

function getDirectoriesRecursive(directoryPath: string): string[] {
  let directories: string[] = []

  // Read the contents of the current directory
  const items = readdirSync(directoryPath, { withFileTypes: true })

  for (const item of items) {
    const fullPath = Path.join(directoryPath, item.name)

    // Check if the item is a directory
    if (item.isDirectory()) {
      directories.push(fullPath) // Add the current directory to the list
      // Recursively call the function for subdirectories and add their results
      directories = directories.concat(getDirectoriesRecursive(fullPath))
    }
  }
  return directories
}
