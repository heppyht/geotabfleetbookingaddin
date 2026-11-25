(function (root) {
  'use strict';

  function createUsersView(deps) {
    var userDomain = deps.userDomain;
    var fmt = deps.formatters;
    var state = deps.state;
    var onRefresh = deps.onRefresh;

    var userDataStatus = document.getElementById('userDataStatus');
    var refreshUsersButton = document.getElementById('refreshUsersButton');
    var userSearch = document.getElementById('userSearch');
    var userStatusFilter = document.getElementById('userStatusFilter');
    var userListBody = document.getElementById('userListBody');

    function setStatus(message, isError) {
      userDataStatus.textContent = message;
      userDataStatus.setAttribute('data-error', isError ? 'true' : 'false');
    }

    function setLoading(isLoading) {
      refreshUsersButton.disabled = Boolean(isLoading);
    }

    function render() {
      userListBody.textContent = '';
      if (state.usersLoadState === 'idle' || state.usersLoadState === 'loading') {
        userListBody.appendChild(fmt.createTableEmptyRow(
          6,
          state.usersLoadState === 'loading' ? 'Loading users...' : 'Select the Users tab to load user records.'
        ));
        return;
      }
      if (state.usersLoadState === 'error') {
        userListBody.appendChild(fmt.createTableEmptyRow(6, 'The user list could not be loaded.'));
        return;
      }

      var search = userSearch.value.trim().toLowerCase();
      var statusFilter = userStatusFilter.value;
      var users = state.users.filter(function (user) {
        var clearance = userDomain.getUserClearanceLabel(
          user,
          state.securityGroupNames,
          state.securityGroupsLoaded
        );
        var searchable = [
          userDomain.getUserFullName(user),
          user.login,
          userDomain.getUserRoleLabel(user),
          user.customUserRole,
          clearance,
          user.isDriver ? 'Driver' : ''
        ].join(' ').toLowerCase();
        return (!search || searchable.indexOf(search) !== -1) &&
          (statusFilter === 'all' || userDomain.getUserStatus(user).toLowerCase() === statusFilter);
      }).sort(function (first, second) {
        return userDomain.getUserFullName(first).localeCompare(userDomain.getUserFullName(second));
      });

      if (users.length === 0) {
        userListBody.appendChild(fmt.createTableEmptyRow(
          6,
          state.users.length ? 'No users match the selected filters.' : 'No user records are visible to this account.'
        ));
        return;
      }

      users.forEach(function (user) {
        var row = document.createElement('tr');
        var values = [
          userDomain.getUserFullName(user),
          user.login || 'N/A',
          userDomain.getUserRoleLabel(user),
          userDomain.getUserClearanceLabel(user, state.securityGroupNames, state.securityGroupsLoaded),
          userDomain.getUserDriverLabel(user)
        ];
        values.forEach(function (value) {
          var cell = document.createElement('td');
          cell.textContent = value;
          row.appendChild(cell);
        });

        var statusCell = document.createElement('td');
        var status = userDomain.getUserStatus(user);
        var statusBadge = document.createElement('span');
        statusBadge.className = 'user-status user-status-' + status.toLowerCase();
        statusBadge.textContent = status;
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);
        userListBody.appendChild(row);
      });
    }

    function bind() {
      refreshUsersButton.addEventListener('click', function () {
        onRefresh(true);
      });
      userSearch.addEventListener('input', render);
      userStatusFilter.addEventListener('change', render);
    }

    return {
      bind: bind,
      render: render,
      setLoading: setLoading,
      setStatus: setStatus
    };
  }

  root.FleetAddIn = root.FleetAddIn || {};
  root.FleetAddIn.UsersView = {
    create: createUsersView
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
