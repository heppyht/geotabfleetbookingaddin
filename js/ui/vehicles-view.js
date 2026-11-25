(function (root) {
  'use strict';

  function createVehiclesView(deps) {
    var fmt = deps.formatters;
    var vehicleInventory = document.getElementById('vehicleInventory');

    function render(devices) {
      vehicleInventory.textContent = '';
      if (!devices || devices.length === 0) {
        var empty = document.createElement('li');
        empty.textContent = 'No vehicles are available to this account.';
        vehicleInventory.appendChild(empty);
        return;
      }

      devices.forEach(function (device) {
        var item = document.createElement('li');
        var statusLabel = fmt.isDeviceActive(device) ? ' (Active)' : ' (Inactive)';
        item.textContent = (device.name || 'Unnamed vehicle') + ' [' + device.id + ']' + statusLabel;
        vehicleInventory.appendChild(item);
      });
    }

    return {
      render: render
    };
  }

  root.FleetAddIn = root.FleetAddIn || {};
  root.FleetAddIn.VehiclesView = {
    create: createVehiclesView
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
