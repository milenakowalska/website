
exports.getDate = function() {
    let today = new Date();

    const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };

    return today.toLocaleDateString('de-DE', options);
}