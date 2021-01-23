import './App.css';
import {connect, Provider} from 'react-redux'
import createSagaMiddleware from 'redux-saga'
import {applyMiddleware, compose, createStore} from 'redux'
import {createBrowserHistory} from "history";
import {put, takeEvery} from "redux-saga/effects";
import * as R from 'ramda'

const lensPathWithDefault = (lensPath, theDefault) => {
    const theLens = R.lensPath(lensPath)
    const getter = R.pipe(R.view(theLens), R.defaultTo(theDefault))
    const setter = R.set(theLens)
    return R.lens(getter, setter)
}

const fetchText = async (resource, init) => {
    try {
        const response = await fetch(resource, init)
        const text = await response.text()
        return text
    } catch (error) {
        const messageLines = []
        messageLines.push(`Unable to fetch resource '${resource}'`)
        if (init) {
            messageLines.push(`options = ${JSON.stringify(init)}`)
        }
        messageLines.push(`message = ${error.message}`)
        throw new Error(R.join('\n', messageLines))
    }
}

const fetchJson = async (resource, init) => {
    const text = await fetchText(resource, init)
    try {
        return JSON.parse(text)
    } catch (error) {
        const messageLines = []
        messageLines.push(`Unable to json from text '${text}'`)
        messageLines.push(`resource = ${resource}`)
        if (init) {
            messageLines.push(`options = ${JSON.stringify(init)}`)
        }
        messageLines.push(`message = ${error.message}`)
        throw new Error(R.join('\n', messageLines))
    }
}

const FETCH_PAGE_REQUEST = 'NAVIGATION/FETCH_PAGE_REQUEST'
const FETCH_PAGE_SUCCESS = 'NAVIGATION/FETCH_PAGE_SUCCESS'
const REDIRECT = 'NAVIGATION/REDIRECT'
const ADD_PROFILE_REQUEST = 'PROFILE/ADD_PROFILE_REQUEST'
const FETCH_PROFILES_REQUEST = 'PROFILE/FETCH_PROFILES_REQUEST'
const FETCH_PROFILES_SUCCESS = 'PROFILE/FETCH_PROFILES_SUCCESS'
const PROFILE_NAME_CHANGED = 'PROFILE/PROFILE_NAME_CHANGED'
const DELETE_PROFILE_REQUEST = 'PROFILE/DELETE_PROFILE_REQUEST'
const FETCH_TASKS_REQUEST = 'TASK/FETCH_TASKS_REQUEST'
const FETCH_TASKS_SUCCESS = 'TASK/FETCH_TASKS_SUCCESS'
const TASK_NAME_CHANGED = 'TASK/TASK_NAME_CHANGED'
const ADD_TASK_REQUEST = 'TASK/ADD_TASK_REQUEST'
const UPDATE_TASK_REQUEST = 'TASK/UPDATE_TASK_REQUEST'
const DELETE_TASKS_REQUEST = 'TASK/DELETE_TASKS_REQUEST'
const FETCH_SUMMARY_REQUEST = 'SUMMARY/FETCH_SUMMARY_REQUEST'
const FETCH_SUMMARY_SUCCESS = 'SUMMARY/FETCH_SUMMARY_SUCCESS'

const eventFetchPageRequest = () => ({type: FETCH_PAGE_REQUEST})
const eventFetchPageSuccess = page => ({type: FETCH_PAGE_SUCCESS, page})
const eventRedirectRequest = uri => ({type: REDIRECT, uri})
const eventFetchProfilesRequest = () => ({type: FETCH_PROFILES_REQUEST})
const eventAddProfileRequest = name => ({type: ADD_PROFILE_REQUEST, name})
const eventFetchProfilesSuccess = profiles => ({type: FETCH_PROFILES_SUCCESS, profiles})
const eventProfileNameChanged = name => ({type: PROFILE_NAME_CHANGED, name})
const eventDeleteProfileRequest = id => ({type: DELETE_PROFILE_REQUEST, id})
const eventFetchTasksRequest = () => ({type: FETCH_TASKS_REQUEST})
const eventFetchTasksSuccess = ({profile, tasks}) => ({type: FETCH_TASKS_SUCCESS, profile, tasks})
const eventTaskNameChanged = name => ({type: TASK_NAME_CHANGED, name})
const eventAddTaskRequest = task => ({type: ADD_TASK_REQUEST, task})
const eventUpdateTaskRequest = task => ({type: UPDATE_TASK_REQUEST, task})
const eventDeleteTasksRequest = taskIds => ({type: DELETE_TASKS_REQUEST, taskIds})
const eventFetchSummaryRequest = () => ({type: FETCH_SUMMARY_REQUEST})
const eventFetchSummarySuccess = ({profileCount, taskCount}) => ({
    type: FETCH_SUMMARY_SUCCESS,
    profileCount,
    taskCount
})

const lensPage = lensPathWithDefault(['navigation', 'page'], '')
const lensProfileCount = lensPathWithDefault(['summary', 'profileCount'], 0)
const lensTaskCount = lensPathWithDefault(['summary', 'taskCount'], 0)

const reduceFetchPageSuccess = (state, event) => R.set(lensPage, event.page, state)
const reduceFetchSummarySuccess = (state, event) => R.pipe(
    R.set(lensProfileCount, event.profileCount),
    R.set(lensTaskCount, event.taskCount))(state)

const sagaMiddleware = createSagaMiddleware()
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const reducer = (state, event) => {
    switch (event.type) {
        case FETCH_PAGE_SUCCESS :
            return reduceFetchPageSuccess(state, event)
        case FETCH_SUMMARY_SUCCESS:
            return reduceFetchSummarySuccess(state, event)
        default:
            return state
    }
}

const store = createStore(
    reducer,
    {},
    composeEnhancers(applyMiddleware(sagaMiddleware))
)
const history = createBrowserHistory()

const handleRedirect = function* (event) {
    const uri = event.uri
    history.push(uri)
    history.go(0)
}

const profileUriPattern = /^\/profile($|\/)/
const taskUriPattern = /^\/task\/([^/]*)/

const handleFetchPageRequest = function* () {
    const uri = history.location.pathname
    if (profileUriPattern.test(uri)) {
        yield put(eventFetchPageSuccess("profile"))
        yield put(eventFetchProfilesRequest())
        yield put(eventFetchSummaryRequest())
    } else if (taskUriPattern.test(uri)) {
        yield put(eventFetchPageSuccess("task"))
        yield put(eventFetchTasksRequest())
        yield put(eventFetchSummaryRequest())
    } else {
        yield put(eventRedirectRequest('/profile'))
    }
}

const handleFetchSummaryRequest = function* () {
    const profiles = yield fetchJson('/proxy/profile')
    const profileCount = profiles.length
    const tasks = yield fetchJson('/proxy/task')
    const taskCount = tasks.length
    yield put(eventFetchSummarySuccess({profileCount, taskCount}))
}

const saga = function* () {
    yield takeEvery(FETCH_PAGE_REQUEST, handleFetchPageRequest)
    yield takeEvery(FETCH_SUMMARY_REQUEST, handleFetchSummaryRequest)
    yield takeEvery(REDIRECT, handleRedirect)
}

sagaMiddleware.run(saga)
store.dispatch(eventFetchPageRequest())

const PageNotFound = ({page}) => <h1>{`Page '${page}' not found`}</h1>

const Profile = () => <div>Profile Component</div>
const Task = () => <div>Task Component</div>

const Summary = ({profileCount, taskCount, errors}) =>
    <div className={"Summary"}>
        <span>Number of profiles = {profileCount}</span>
        <span>Number of tasks across all profiles = {taskCount}</span>
    </div>

const mapSummaryStateToProps = state => ({
    profileCount: R.view(lensProfileCount, state),
    taskCount: R.view(lensTaskCount, state)
})

const mapSummaryDispatchToProps = dispatch => ({})

const ConnectedSummary = connect(mapSummaryStateToProps, mapSummaryDispatchToProps)(Summary)

const Navigation = ({page}) => {
    const pageMap = {
        profile: Profile,
        task: Task
    }
    const Component = pageMap[page] || PageNotFound
    return <div className={'Navigation'}>
        <Component/>
        <ConnectedSummary/>
    </div>
}

const mapNavigationStateToProps = state => ({
    page: R.view(lensPage, state)
})

const mapNavigationDispatchToProps = dispatch => ({})

const ConnectedNavigation = connect(mapNavigationStateToProps, mapNavigationDispatchToProps)(Navigation)

const App = () => <div className={'App'}>
    <Provider store={store}>
        <ConnectedNavigation/>
    </Provider>
</div>

export default App;
